# TODO — DEFLECT

Status legend: `[ ]` not started · `[x]` done · `[~]` partial / placeholder · `[!]` blocked

## Quarantine split + portal suction (2026-11-04)

- [x] Split QUARANTINE into four arena records: INTAKE (14), HOLDING (34), MAINBOARD (35), ROUTER (36)
- [x] Campaign route is INTAKE -> HOLDING -> MAINBOARD -> ROUTER -> REBOOT; each clear saves and hops
- [x] Right-wall exit portals, left-wall entry portals; direct collision-free ~1.15 s suction, then wipe
- [x] First hop plays script_kitty's "IT WORKED! ... clear this infection" beat on HOLDING arrival
- [x] Feed rooms open in live fire: MAINBOARD two ports, ROUTER one, no party-port prop
- [x] Split probes green: `quarantine-check`, `holding-layout-check`, `port-sweep-check`, `exit-route-check`, `islands-ports-check`, `round-hop-check`
- [x] Headed dev pass: INTAKE -> portal -> HOLDING, `VIA PORTAL`, kitty line on screen, no console errors
- [ ] Published campaign pass on 0.1.180 (the user will run this)

## Island hops (2026-11-04)

- [x] Superseded 2026-11-04: QUARANTINE is now four portal-fed arenas, not one flattened floor

- [x] Retire the campaign bridge system: no `closed` decks, `openBridge`, `bridgeMask` or `portalBridge`
- [x] Flatten QUARANTINE into one continuous device floor; its four rooms are painted plates
- [x] Ports gate the white party port directly; the third closure opens the exit, with no bridge pacing
- [x] Seed the flat assault by painted room, so BUILD ROOT opens populated after the flatten
- [x] Campaign clears auto-hop through script_kitty's portal, saving the slot before the cut
- [x] Round-based modes hop: round-end pull, next-arena rebuild, carried scores/round, host `MSG.HOP`, guest `NetView` rebuild
- [x] Square portal wipe in the renderer (`beginPortalHop`) covers the swap without gating input
- [x] Probes: `plate-flow-check`, `holding-layout-check`, `port-sweep-check`, `port-route-check`, `exit-route-check`, `islands-ports-check`, `round-hop-check`
- [x] Headed portal-hop pass on the dev build: `?autoplay=3` hopped CROSSROADS -> GRID ZERO -> THE RING -> SWITCHBACK across rounds 2-4
- [x] Production check: Pages run `41752976683` succeeded; the live page logs `Build 0.1.179`, serves `sw.js` `deflect-0.1.179`, and its bundles return 200
- [ ] Headed campaign auto-hop and a published-build playthrough

Last updated: 2026-11-04 (QUARANTINE SPLIT + PORTAL SUCTION)
Formerly: 2026-11-04 (EXIT-FRAME VARIANTS FALSIFIED)
Formerly: 2026-11-03 (CAMPAIGN PLAYTHROUGH PASS)
Formerly: 2026-11-02 (BOSS SWEEP + CAMPAIGN LEVEL 2)
Formerly: 2026-11-02 (PLATES + PORTS)

---

## Boss sweep and campaign levels 1-2 (2026-11-02)

- [x] Cross-arena boss matrix: five mini-bosses in `CROSSROADS`, `GRID ZERO`, `SWITCHBACK` and `QUARANTINE` spawn, stay finite, stay near their arena and die through their own damage path (20/20, `.tmp/boss-matrix.ts`)
- [x] `cullVoidThreats` skips every mini-boss (`bossKind >= 0`), not only the Mega Worm and the Blob: the floor cull was deleting a boss that flew over a hole
- [x] Worm hit tests use `w.hitR` / `w.segR` instead of the 16/10 normal-worm constants, so bombs, lash, dash, orbit balls and sentries actually touch a 3x body
- [x] `spawnWorm` resets both radii; a pooled slot that carried a boss no longer gives a normal worm a 138-unit hit circle
- [x] Explosions test every plate and skip the floor line-of-sight check for a mini-boss; Kaboom and the Pinball arm can damage the Mega Worm
- [x] Viruses no longer infect mini-bosses (`infectWorm` healed the boss to full mid-fight and made it unkillable)
- [x] Mega Worm flyby retuned to 940/380/1.0/760: ~35% floor uptime instead of ~20%, a solo clear in 55-115 s per kit instead of a 186 s grind
- [x] `.tmp/mw-programs.ts` gate: all thirteen programs kill the boss through their own kit
- [x] Campaign level 2 (`REBOOT` on `GRID ZERO`) is playable with the Mega Worm as its final encounter; boss nodes clear on the boss, not a kill count or a port
- [x] `.tmp/campaign2-check.ts`: three level 2 runs with three bot companions clear in 67/80/72 s
- [ ] Headed pass: watch a full level 2 run with a human pilot and judge the Mega Worm's contact pressure and the four-kill run-up
- [ ] A human boss-rush clear time per boss, recorded in HISTORY

---

## Campaign playthrough pass (2026-11-03)

> Measurements below were taken on the retired QUARANTINE plate layout. v0.1.179 flattens the device, so
> the exit-leg and plate-seam void falls no longer exist; these entries stay for the record, not as open
> work.

- [x] Headed Chromium runs of the live campaign surfaced a soft-lock: a body downed during
      `calibration`/`release`/`briefing`/`breach` set `respawnT` but only the `drill` branch ever ticked it, so
      the body stayed dead, the lesson waited on an input that could never arrive, and no overlay offered a way out
- [x] Fixed in `world.ts`: the campaign respawn timer ticks in every live phase (`failed` and `cleared` excluded),
      so a fall or a downed body before the assault always comes back and keeps its tutorial progress
- [x] `.tmp/campaign-death-check.ts`: five pre-assault phases x player and drill partner, plus the rule that an
      assault death still fails the run and never respawns
- [x] `.tmp/campaign-pilot.js` + `.tmp/campaign-auto.js`: a headed QA pilot that dispatches ordinary key events and
      a menu auto-runner that takes NEXT ARENA, RETRY and the next save slot, so a campaign can be watched end to end
- [ ] A full four-run headed pass. The pilot reaches the assault but does not reliably finish the `BUILD ROOT` port
      sweep, so no headed campaign has completed; every clear so far comes from the headless probes
- [x] BUILD ROOT ports were authored inside cover pillars: two of the three could not be shot from any direction, so the sweep was impossible. Moved to open floor (mainboard A 1330,900 and router 1350,230; B stays 1780,940) and `spawnCampaignPorts` now nudges a buried port to clear ground
- [x] Sweep confirmed clearable: `.tmp/port-sweep-check.ts` closes all three ports in 17.4 s of ordinary ranged fire and clears the node; a headed Chromium run closed 2 of 3 ports by real play before the session ended
- [x] Exit-frame variants measured out and reverted: the exclusive `exitFrame` before target selection and
      the `floorSweep` opt-out while exit-ready each produced 0/4 clears (worse than the 1/4 baseline). The
      port-count divergence is falsified: the 192 s death was an ordinary assault death at 1/3 ports, so the
      exit was never armed
- [ ] Per-second exit trace on a failing seed (5391916): exit readiness, live portal count, distance to the
      prop and the chosen steering branch after the quota is met. Name the cause before another structural change
- [ ] Human prod test of campaign levels 1-2 (feedback pending)
- [ ] Four headed start-to-finish campaign runs (level 1 -> level 2 -> Mega Worm) with per-run logs
- [x] Holding plate entry: the intake bridge landed behind the sealed cell block, so QUARANTINE dropped a body into a
  strip it could not leave. Cell block moved back-right, intake deck lands on the open left, holding->mainboard deck
  joins in front of the cells (`holdingCellLayout`, `.tmp/holding-layout-check.ts`)
- [x] Plate flow audited for every authored plate arena: QUARANTINE passes entry-left/exit-right, CAPCOM and
  TRANSIT carry documented exceptions in `.tmp/plate-flow-check.ts`; no deck lands in cover, a cell block or the void
- [x] Sequential harness reaches the assault on real kills (calibration, drill, breach all earned); the
  calibration-targeting bug was a probe bug and is fixed in `.tmp/campaign-playthrough-check.ts`
- [x] Continuous run travels again: eight-direction stepping with a 26/52-unit look-ahead reaches `assault` at 83 s
  (the old straight-line steering was the stall), with the port lane now shot facing the port
- [x] Continuous run clears BUILD ROOT end to end with 3 bots (163.9 s, 21 kills, 3/3 ports, deaths only in the
  respawning practice phases). Three harness faults fixed: floor model now matches `World.inVoid`, the flee dash
  travels along the vector it checked, and melee gets a lash-and-dash answer
- [x] Diagnosis: REBOOT's assault is entered at full 3/3 health and the Mega Worm does spawn (200 hp, 4/4 fodder
  kills). Two probe faults fixed: bots 1-3 were never driven by a brain, and the pilot ignored RESTORE pickups
- [x] Diffed the harnesses: `campaign2-check` runs the pilot at `iframes = 999` with the phase and kill quota
  written directly, so it proves boss mechanics, not survival. The continuous run enters the assault at 3/3 and
  spawns the boss at 200 hp with 4/4 fodder kills
- [x] Boss pattern is fixed and announced: offscreen staging plus a straight latched pass, a 5 s Kitty warning and
  title card before the spawn, and a speed ramp with missing health (`boss-warning-check.ts`)
- [x] Three real bot bugs fixed: no boss lane read, a 300-unit lane gate (0.3 s at 940 u/s), and a 150 standoff
  against a 138-radius head. Survival moved 43-108 s -> 140-285 s and the pilot now damages the boss to ~120 hp
- [x] Pilot now spends the lane dash on the approach (paced one per pass), treats the trailing chain as hazard
  (2400 behind), and breaks off for a RESTORE drop at one segment. Deaths 150-212 s, all `killer 2` now
- [x] Structural bug fixed: the boss escape only ran on frames with no other branch taken. `bossEscape()` now runs
  on all four `think()` exits, and the lane read buys 2600 units of look-ahead with an early dash
- [x] Close-hold engagement replaced by `fightBoss`: 620 ring, chain-corridor avoidance, park-only approach,
  shooter clearance inside 470, dash escape, RESTORE at two segments. Two batches of five each produced one
  clear (181.5 s / 246.6 s, boss 206 -> dead)
- [x] Harness override removed: the probe no longer rewrites the brain's frame. Same five runs went 1/5 -> 2/5
- [x] Demo cut: attract/`?demo=1` stage standalone arenas only, no boss sessions (v0.1.173)
- [x] Port-stall root-caused: harness left slot 0 inert on level 1; objective frame built but pilot dies in `breach` at 88-93 s, so it was reverted unshipped (v0.1.173)
- [x] Death cause found: all 5 chain runs die to `SRC.VOID` (`fallPlayer`) at 88-97 s; QUARANTINE has no `traverse.chasms`, so the pilot walks a room-plate seam. Void guard using traverse.chasms was inert and reverted
- [x] Floor guard using the fall machine's own `offFloor` was batch-tested (0/5) and reverted: deaths are impulse/placement, not steering. Log `fallT`, `kx/ky`, `offFloor` and nearest plate per frame next
- [x] Fall trace: `killer 8` drops are steering (`kx/ky` 0, `fallT` 0.15→0), and the old guard failed because it recovered toward the arena centre, which is the gap on a plate arena
- [x] Nearest-plate floor clamp tested once: did not prevent the drop, reverted. Fall now seen in `drill` at 67 s; body is already off-floor at the first ring frame, so log intended mx/my, dash and the clamp decision next
- [x] Ring proves a narrow-seam walk (mx/my nonzero, dash 0, no knockback); swept floor contact reduced falls to one at 70-72 s but did not eliminate them, reverted
- [x] Tutorial gating proven: 40 s idle stays on `move`, advances to `dash` only after the movement goal; campaign phases gate on `tutorial.done`
- [x] Level 1 primitives-only: `spawnVirus` returns null when the level rule is on; probe shows 0 viruses / 2 worms at assault
- [x] BUILD ROOT floor authored at 1.5x (2.25x area) with geometry moved together; validators green; assault worm fill 1 -> 3
- [x] Port deadlock fixed by layout: all three ingress ports now sit on floor reachable with bridge 2 shut (713/1388/743 -> 0/0/0); party port moved onto walkable floor
- [x] BUILD ROOT clears end to end under the shipped brain: 415.1 s, ports 3/3, phase cleared (seed 5391916)
- [x] Exit leg routed through A* (`followPath`): 1 of 3 seeds clears at 299.2 s with 3/3 ports
- [x] Four exit-leg variants measured and reverted (A* 1/3 @299 s, deck waypoint 1/3 @260 s, +hysteresis 0/3); every seed closes 3/3 ports
- [x] Exit gate proven in code (`portsClosed >= portTotal` opens the prop); the race hypothesis was wrong
- [x] Monotone exit leg clears at 210.3 s on one seed and cycles on the plate/deck seam for two (retired with the plate layout; the flat floor has no seam)
- [x] 8-10 distinct VOID falls remain; seam overlap alone did not remove them (retired with the plate layout; port-sweep reaches the exit in 0.02 s)
- [ ] Five void-fall events remain during scripted phases (respawn-covered, not zero) (measured with an inert slot 0, so re-baseline); BUILD ROOT assault stalls at ports 2/3 after a 10-kill quota, so the chain rarely reaches REBOOT. Port-objective branch in the pilot did not move the stall. Continuous REBOOT is 2/5; remaining deaths are a fodder worm trading at 55 units and head contact at ~153 during the punish window. Punish station moved off-axis and a 260 clearance added, yet head contact still lands at ~152, which is impossible for a flown pass. Trace `w.x/y`, `anchorX/Y`, `spawnT`, `entryT` for the two frames before contact: suspected staging teleport, not pilot tuning. Level 1 not re-measured (root cause: `fightBoss` was unreachable from `think()`'s early returns; now hoisted). Remaining: head contact at ~155 during the punish station; trace the 0.2 s before contact. Remaining: boss-head contact at ~155 when the launch catches the
  punish approach, and sentry fire at ~220 from beyond the 470 ring. Sampling is still not five distinct runs:
  runs 1 and 5 repeat because `fightBoss` ignores the per-run style. Boss must not be weakened
- Harness limitation, stated for the record: the probe routes on `islands`/open `bridges` with plain input frames;
  it is not a game rule that stops it, since `port-sweep-check` closes all three ports in 17.4 s
- [ ] Port sweep pacing with a human solo pilot: three ports at 20-26 hits each, while the drill squad ignores them

---

## Session feedback (2026-11-01)

- [x] `SessionTracker` in `src/game/sessionReport.ts`: setup, per-player actions, round deltas, deflect sources, result and environment
- [x] Automatic in-memory capture for training, VS BOTS, local, gauntlet, infection, campaign and online games
- [x] FPS / frame-time / sim-time sampling every second while play is live
- [x] Opt-in `SHARE FEEDBACK` on result and leave overlays; Web Share JSON file with download/copy fallback
- [x] Callsigns, room codes, IPs and raw inputs omitted; no backend, token or automatic upload
- [x] Headless probe (`.tmp/session-report-check.ts`) for action counts, round deltas, summary, perf and share text
- [x] `npx tsc --noEmit`, `npm run build` and `git diff --check` clean
- [ ] Headed pass: native share sheet on a phone, and the download/copy fallback on desktop
- [ ] Optional future ingest endpoint behind a server-side service; never a client token

---

## Multiplayer status (2026-11-02)

- [x] Add `MpStatus` and rate-limited `MSG.PING` / `MSG.PONG` telemetry to host and guest peers
- [x] Measure application RTT and live snapshot cadence without touching `LobbyState` or `Snapshot`
- [x] Lobby `RTT` stat plus the in-game `MP STATUS` panel (role, room, players, RTT, snapshot Hz)
- [x] Hide the panel with `GAME UI`, loading and overlays; older peers degrade to `--`
- [x] `npx tsc --noEmit` clean
- [ ] Two-real-client pass: verify RTT, snapshot cadence, disconnect fallback and legacy-peer `--` state

---

## Ports (2026-11-02)

- [x] Record the portal design: red damageable enemy ports, white player entry/exit ports, clear-the-system as the win state
- [x] Note the spawn paths it replaces (`spawnSentryPack` ring, `spawnVirusCluster` far spawn, `setupInfection` opening flood)
- [x] Author `ingress` on `ArenaDef` and draw the red square with its square-particle leak
- [x] Emit the existing threat families through ports, reusing pools, caps and wave gates
- [x] Port health, a damaged state and a close beat; every damaging action closes one (ranged, lash, damaging skills and supers, with a 0.3 s contact cooldown)
- [x] Tune ports to bite: 20–26 hits and a 2.6–3 s emission cadence on BUILD ROOT
- [ ] Confirm Aim Bot's rail round and Atomize's orbit projectiles close a port; both resolve through their own hit paths rather than `propHit`
- [x] Replace the campaign kill pips with port pips, and gate the exit on closing every port then walking out
- [x] White exit port on the uplink, with the walk-in clear
- [x] Headless probe: emission comes only from open ports, a closed port stops emitting, the exit needs every port, no `Snapshot` fields
- [x] script_kitty mission-control beats when the last port closes
- [ ] Route the INFECTION opening flood and `spawnVirusCluster` through authored ports (BUILD ROOT is done; a portless arena still seeds directly)
- [ ] Draw the white *entry* port at the start of a level
- [ ] Bots target a port when no player is in range
- [ ] Author ports for the rest of the campaign route, not only the mainboard and router plates

---

## Sub-agents (mini-bosses) (2026-11-02)

- [ ] Author a sub-agent schedule for campaign and gauntlet: a named mini-boss arrives every N seconds or per wave, announced by a banner
- [ ] Give a sub-agent its own silhouette, a health pool and one readable attack; reuse the sentry family rather than adding a second AI controller
- [ ] Keep sub-agent state local-only per D9: nothing in `Snapshot`, `SnapshotHazards` or the objective strip
- [x] Rebuild the Mega Worm as one rigid straight body, staged off-map and committed to a latched straight pass (v0.1.149)
- [x] Collapse the Mega Worm to one health pool with contact-only damage: no head snap, plate breaks, legs or split pieces (v0.1.150)
- [ ] Headed boss-rush pass: one human clear of the full ladder, with time per boss recorded

---

## Mega Worm boss (2026-11-02)

- [x] Chain of plates with per-node health; damage follows the contact point
- [x] Interior break splits the chain; detached half grows a head at its far tip
- [x] Head break promotes the next plate instead of killing the worm
- [x] Committed body whip with a tangential throw and one hit per player per swing
- [x] Last plate grows legs: sprint, lunge bite and paired acid
- [x] Arrives through the edge ingress on wave 8, repeating every 14 waves
- [x] Cracks and code debris instead of a health bar
- [x] Probe: `.tmp/megaworm-check.ts`; `?mega=1` QA boot hook
- [x] Memory fragments: downed players drop a stacking +1 HP / +20% speed / +25% damage shard, PvE only
- [x] Campaign carry-over for stacks across nodes, with one drop per body per run
- [x] File Blob: 96 icon health, 10-node spring rim, shrink with damage; 3x body and a single-pass center-out opaque file haystack
- [x] Glue cage from the lobbed glob: dash-proof root, three attack presses to escape, Ghost cloak phases out
- [x] Starfish: five detachable arms, hatch-into-a-new-boss rule, mouth suck/chomp, armless spine ring; smaller core, bigger arms, detached arms keep their arm shape
- [x] Arms as separate pool bodies so every weapon can target a specific arm; live-cap prevents boss floods
- [x] Idle Hands: three floating palms, slam telegraph, finger charge, dash redirect; Unicode `✋`/`☝` hands and `👁` palm eye; ~3x body scale, solid red palm, fixed red eye on a black socket, layered shadow, slower tells, tighter slam ring, hand-on-hand stun
- [x] Idle Hands entrance: rise from the ground while yawing front > back > front, with a slight in-plane twist and the eye hidden on the back half
- [x] Slow the four staged mini-boss entrances; Starfish now hangs overhead, then falls under acceleration
- [x] Idle Hands: front/side hover targeting so a palm never settles over the player sprite
- [x] Idle Hands: 340-unit separation margin so the three palms cannot stack
- [x] Hand bodies reuse the worm pool via `bossKind`, so every weapon and bot already hits them
- [x] Mini-boss registry (`minibosses.ts`), `Worm.bossKind` and one `spawnMiniboss` entry point
- [x] Data-driven wave gates (`GAUNTLET.bossSchedule`); bosses arrive through assault family 3
- [ ] Second mini-boss entry, plus a level that spawns two kinds at once
- [ ] Give the acid its own green render instead of reusing hostile bolt art
- [ ] Boss health and phase read on the minimap so an off-screen split is visible
- [ ] Second boss silhouette once this one has been played; keep the plate language
- [ ] Campaign boss slot for THE BROODMOTHER using this chain

---

## Gauntlet ingress (2026-11-02)

- [x] Edge portals: open, spew a batch, close immediately; no mid-floor spawns
- [x] Placement keeps 430 units from the player and stays on the arena bounds edge
- [x] Sentry packs, worms and virus clusters all queue through the portals
- [x] Pack timer waits for a pending burst, so caps cannot be double-filled
- [x] Probe: edge lane placement, player clearance, full burst delivered, portal closes, no direct pack spawn
- [ ] Cascading error blocks still seed from the existing path; route the first block through a portal too
- [ ] Camera cue when a portal opens off-screen (edge chevron) so the burst is never a surprise
- [ ] A late-wave second portal that announces itself with a louder opening beat

---

## Weapon systems jet (2026-11-02)

- [x] Replace the polygon with `FIGHTER_TOP`: nose-up plan view with both wings, canopy, tail planes, fin, intakes and nozzle
- [x] One silhouette shared by the arena console and the arena picker; probe rejects a re-inlined blob
- [x] Place `FIRE WEAPONS` by the wing root, `EJECTOR SEAT` by the cockpit and `THRUSTERS` by the tail
- [x] Panel detail: centre spine, wing-root seams, hardpoints, exhaust streaks, top-profile caption
- [x] Reticle moved onto the nose
- [ ] Animate the control surfaces during the heavy-attack readout
- [ ] A top-down companion silhouette for a future map that needs one
- [ ] Per-program tail markings instead of the generic F-19 number

---

## AIRPORT flipboard (2026-11-02)

- [x] The board fills the arena: no terminal apron, no furniture cover, spawns moved onto the board
- [x] 18 rows in two banks (3x the old six), nine arrivals and nine departures
- [x] Every text field flips: time, destination, gate and status each cycle a deck and animate separately
- [x] A landed row damages its whole bank band (`flipRowRectAt`), once per period
- [x] Probe: board coverage, row counts, static-text rejection, text-field damage away from the time cell
- [ ] Destinations that suit the flight time (a 09:10 board should not show a 20:58 leg)
- [ ] A gate-change callout every few cycles, so the board has one readable event beyond the wave
- [ ] Decide whether a flipped row should also shove loose props, not only bodies

---

## AIR TRAFFIC (2026-11-02)

- [x] Arena 33: circular radar disc, six console desks as cover, slow sweep (11 s) that never damages
- [x] `World.tickRadar`: straight-line aircraft passes on one clock, damage to players, drone and gauntlet threats
- [x] One hit per aircraft per pass per body, so a slow pass cannot shred a body
- [x] Probe: floor ends at the rim, every pass crosses the disc, spawns and cover on the scope, single hit per pass
- [ ] Conflict alerts: a brief tag flip when two aircraft cross close together (presentation only)
- [ ] A campaign node that uses the scope, with the sweep as a patrol clock
- [ ] Decide whether aircraft should be deflectable (they are terrain-scale hazards today)

---

## CAPCOM (2026-11-02)

- [x] Arena 32: four department plates in a 2×2 ring (CAPCOM, FIDO, GUIDO, EECOM) with four open decks
- [x] Per-department cover: offset flight tiers, plotting tables, gyro pedestal, switchgear walls
- [x] Per-department furniture sets via `ArenaRoomDef.variant`, one palette (`console`)
- [x] `console` room theme: CRT bank, plotting board with a live trajectory, mission clock, department stencil
- [x] Console banks double as the cover pillars; two stations per plate for spawns
- [x] Headless probe: plates do not overlap, every deck starts open, gaps beat a dash, spawns and cover sit on plates
- [ ] Give each department a distinct console layout instead of one shared bank
- [ ] A mission-clock or abort objective for a future campaign node on this floor
- [ ] Decide whether plate arenas can ever enter hosted rotation (needs a protocol decision first)

---

## Replicators (2026-11-02)

- [x] Record the second ingress: a machine that prints one family where a network port would be nonsense
- [x] `ArenaDef.replicator`, sharing the port clock, damage path and close beat, excluded from the campaign tally
- [x] Draw the amber chassis, the travelling print bar and the copies on the tray
- [x] First fixture on SATELLITE: pulse units, 24 health, a copy every 4 s
- [x] Headless probe: it spawns, prints, closes, stops printing, and never counts as a campaign port
- [ ] Author replicators on the other offline or hardwired devices as their campaign nodes land
- [ ] Decide whether a replicator can print a *variant* of a family (armoured, faster) instead of a plain copy

---

## Campaign spine (2026-11-02)

- [x] Record the island-hopping spine: clear each network's infections to earn its uplink, and end the run by finding and deleting the rogue AI agent behind the spread
- [x] Reframe the antagonist row in `CAMPAIGN.md`: one rogue AI agent at `ROOT`, presentation still open
- [ ] Per-island infection tally in the campaign run state (`src/game/saves.ts`), saved with the level
- [ ] Gate the sector exit on that tally instead of the current kill count, and share the gate with the objective strip
- [ ] Author the agent's presence across the hops and its `ROOT` encounter, keeping narration cosmetic per D13
- [ ] Decide whether an island can be left with live infections, and how a cleared island reads on the route plate

---

## SPREADSHEET + CHAT (2026-11-02)

- [x] Extend `ArenaLaptopDef` with `variant`, `bubbleW` and a `sheet` cell grid; BUSINESS LAPTOP keeps the mail default
- [x] SPREADSHEET (id 30): 6×4 grid, 17 breakable cells, 70-unit corridors, selection cursor and cell inspector
- [x] A direct ranged shot spends one of two cell hits; a cleared cell opens its lane until the round ends
- [x] CHAT (id 31): eight rising bubbles that alternate sides, plus the pinned composer strip
- [x] Bubbles keep a 96-unit gap and wrap individually below the pane, so bodies pass between rows and the stream never resets as one block
- [x] Bubbles are solid only while fully inside the pane, so a clipped card cannot block a spawn row
- [x] Headless probe (`.tmp/laptop-variants-check.ts`): ids/order, cell destruction and round restore, cursor clock, bubble travel, gap clearance, one off-screen wrap per bubble per cycle, spawn clearance across a full scroll and snapshot isolation
- [x] `npx tsc --noEmit`, `npm run build` and `npm run bench` clean
- [ ] Headed pass: read the sheet corridors, the cracked-cell state and the alternating bubble lanes at play size
- [ ] Optional: bot pathing around a cleared lane, plus a sheet-cursor or chat-conveyor hazard

---

## BUSINESS LAPTOP (2026-11-02)

- [x] Add `laptop` data to `ArenaDef`; id 29 after SMART WATCH
- [x] Email screen with left inbox, right preview and a laptop bezel
- [x] Four endless inbox cards scrolling upward with shared clock geometry
- [x] Four message layouts that replace the right-side dynamic cover every 8 seconds
- [x] Dynamic body, threat, shot, bomb and laser collision against cards and preview cover
- [x] New-message flash, preview progress bar, picker preview and custom renderer
- [x] Headless probe (`.tmp/laptop-arena-check.ts`): id/order, message changes, moving cards, cover swap, spawn clearance, reset and snapshot isolation
- [ ] Headed pass: read the moving inbox, preview flash and cover corridors at play size
- [ ] Optional: add bot pathing around moving cards and preview cover
- [x] Future variants: spreadsheet corridors and breakable cells, then a rising chat conveyor (shipped as SPREADSHEET and CHAT in v0.1.124)

---

## SMART WATCH (2026-11-02)

- [x] Add `watch` data to `ArenaDef`; id 28 after SMOKE DETECTOR
- [x] Large rounded watch face with a digital crown, minute ticks, time readout and four raised app complications as static cover
- [x] Live clockwise second hand that damages players, the drone and all gauntlet threat families once per revolution; add `SRC.WATCH`
- [x] Dashing and phased bodies avoid the hand; cover does not stop the floor projection
- [x] Reset the hand clock and hit masks in `beginRound()`
- [x] Picker preview and custom renderer
- [x] Headless probe (`.tmp/watch-arena-check.ts`): id/order, hand geometry, spawn clearance, first hit, one-hit-per-revolution, reset and snapshot isolation
- [ ] Headed pass: read the hand, pivot and app cards at play size
- [ ] Optional: teach bot navigation to avoid the hand line or wait for it to pass

---

## SMOKE DETECTOR (2026-11-02)

- [x] Add `smoke` data to `ArenaDef`; id 27 after SMART PLUG
- [x] Round detector face using the existing `disc` rim with zero spin, no holes and no read arm
- [x] Four floor smoke sensors that arm a timed central siren when a body steps on one
- [x] Expanding alarm rings that damage players, the drone and all gauntlet threat families once per ring; add `SRC.SMOKE`
- [x] Fixed six-hit battery prop that can be shot out; breaking it stops the siren and disables sensors for the round
- [x] Skip fixed props in movement, separation, rendering and snapshot hazards; restore the battery in `beginRound()`
- [x] Custom renderer with detector ridges, sensor pads, siren horn, live rings and battery health
- [x] Picker preview
- [x] Headless probe (`.tmp/smoke-arena-check.ts`): id/order, round floor and spawn clearance, sensor trigger, wave hit, battery shutdown, reset and snapshot isolation
- [ ] Headed pass: read the round face, sensor warning and live rings at play size
- [ ] Optional: teach bot navigation to avoid sensor pads and alarm rings

---

## SMART PLUG (2026-11-02)

- [x] Add `plug` data to `ArenaDef`; id 26 after FAX MACHINE
- [x] Four dual-socket smart-plug modules as static cover around a circuit ring
- [x] Four socket-to-socket arcs with green safe, red warning, live and cooldown phases
- [x] Live arcs damage players, the training drone and all gauntlet threat families once per pulse; add `SRC.PLUG`
- [x] Reset the clock and per-pulse hit masks in `beginRound()`; keep all of it out of `SnapshotHazards` and `isOnlineArena`
- [x] Custom renderer with LEDs, board traces, safe guide, warning preview and jagged live arcs
- [x] Picker preview
- [x] Headless probe (`.tmp/plug-arena-check.ts`): id/order, four modules/arcs, all phases, spawn clearance, one live hit, reset and snapshot isolation
- [ ] Headed pass: read the green/red LEDs, warning blink and live arc against the floor at play size
- [ ] Optional: teach bot navigation to wait out a live ring

---

## FAX MACHINE (2026-11-02)

- [x] Add `fax` data to `ArenaDef`; id 25 after SPACE INVADERS
- [x] Add a 1254×758 fax sheet with four corner toner-drum/paper-stack cover pieces
- [x] Add a compact thermal print carriage that traverses left and right across each row
- [x] Feed down one line at the end of each row, alternating direction and cycling the page
- [x] Make only the small head a once-per-row hazard for players, the drone and all gauntlet threat families
- [x] Add the line-feed reversal beat and `SRC.FAX`
- [x] Reset the head, row, page and hit masks in `beginRound()`; keep all of it out of `SnapshotHazards` and `isOnlineArena`
- [x] Custom renderer and picker preview
- [x] Headless probe (`.tmp/fax-arena-check.ts`): id/order, page stack, row count, all four phases, compact head bounds, live `SRC.FAX` hit and snapshot isolation
- [ ] Headed pass: read the compact head, row steps and line-feed beat at play size
- [ ] Optional: add a bot dodge response to the print head

---

## SPACE INVADERS (2026-11-02)

- [x] Add `invaders` data to `ArenaDef`; id 24 after AIRPORT
- [x] Five-row, ten-column pixel invader fleet as presentation; players spawn inside it
- [x] Three green bunkers as static cover between the fleet and the cannon
- [x] Simulated bottom cannon tracks the nearest live body and fires upward local shots
- [x] Cannon shots damage players, the training drone and all gauntlet threat families; bunkers stop shots
- [x] Reset cannon, aim line and shots in `beginRound()`; keep all of it out of `SnapshotHazards` and `isOnlineArena`
- [x] Custom arena renderer and picker preview
- [x] Headless probe (`.tmp/invaders-arena-check.ts`): id/order, fleet size, bunkers, spawn safety, cannon tracking, `SRC.ARCADE` hit, reset and snapshot isolation
- [ ] Headed pass: read the fleet, bunkers, aim lane and cannon shots at play size
- [ ] Optional: add a bot dodge response to the aim lane

---

## AIRPORT (2026-11-02)

- [x] Add `flip` data to `ArenaDef`; id 23 after PONG
- [x] Six-row arrivals/departures board with cycling time decks and gate/status labels
- [x] Staggered split-flap hazard: warning pulse, flap landing, damage and shove on each time tile
- [x] Terminal furniture and gate-window presentation; benches remain static cover
- [x] Reset the board clock and row states in `beginRound()`; keep it out of `SnapshotHazards` and `isOnlineArena`
- [x] Custom arena renderer and picker preview
- [x] Headless probe (`.tmp/airport-arena-check.ts`): id/order, arrivals/departures split, time-tile bounds, spawn safety, flap timing, hazard damage, `SRC.FLIP`, reset and snapshot isolation
- [ ] Headed pass: read the time tiles and warning pulse against the flight text at play size
- [ ] Optional: teach bot navigation to avoid warning tiles if the hazard proves too punishing

---

## PONG (2026-11-02)

- [x] Add `pong` data to `ArenaDef`; id 22 after CAR NAVIGATION
- [x] Green CRT court with automatic paddles, scoreboard, scanlines and cabinet presentation
- [x] Live rally ball: wall bounces, paddle returns, point scoring and delayed serves
- [x] Ball damages players, the training drone and every gauntlet threat family; dashing bodies avoid it
- [x] Reset score, paddles and rally in `beginRound()`; keep the arena out of `SnapshotHazards` and `isOnlineArena`
- [x] Custom arena renderer and picker preview
- [x] Headless probe (`.tmp/pong-arena-check.ts`): id/order, court bounds, spawn safety, serve, movement, paddle bounds, hazard hit, reset and snapshot isolation
- [ ] Headed pass: read the ball/paddle contrast and score hierarchy at play size
- [ ] Optional: replace the perfect auto-paddles with a deliberate difficulty curve if the rally needs more scoring

---

## SPEAK & FIND and CAR NAVIGATION (2026-11-02)

- [x] Add `seek` and `car` data to `ArenaDef`; ids 20 and 21 after WEAPON SYSTEMS
- [x] SPEAK & FIND: six-card picture board, spoken `FIND THE ...` prompt deck, pulsing target and sweeping magnifier
- [x] Four chunky letter keys as static cover; cards, prompt and magnifier remain presentation
- [x] CAR NAVIGATION: 26 s serpentine GPS route with speed/ETA/next-stop readout and named map pins
- [x] CAR NAVIGATION reworked as a country-to-city map: farmland, farms, tree cover and a river west of the
      split; a street grid with city blocks, a park, a scale bar and a north arrow east of it. Route is 32 s,
      trail 620, and the city legs are square to the grid (v0.1.145).
- [ ] Read the reworked map at couch distance and check the farm labels and district names do not clutter
      the fight; trim labels rather than shrinking type.
- [x] Make the route a real wall: 160 preallocated overlapping blocks in `solids`/`dashSolids`, with body, dash and shot collision
- [x] Cap the live route at 560 units behind the car; older blocks recede so the wall cannot grow into a full-map divider
- [x] Reset the route and clock in `beginRound()`; keep both maps out of `SnapshotHazards` and `isOnlineArena`
- [x] Custom arena renderers and picker previews for both maps
- [x] Headless probe (`.tmp/two-more-maps-check.ts`): ids/order, card/prompt coverage, route length and turns, capped trail, block overlap, growth, reset and snapshot isolation
- [ ] Headed pass: read the prompt/card hierarchy and the receding car trail at play size
- [ ] Optional: teach bot nav about the moving car trail, or carry its clock in a snapshot if online support is requested

---

## Two new local arenas (2026-11-02)

- [x] Add `rocket` and `weapon` data to `ArenaDef`; ids 18 and 19 after SATELLITE
- [x] ROCKET NAVIGATION: 24 s launch, nav telemetry, growing quadratic arc, atmosphere band and stage-separation debris
- [x] Make the arc a real wall: 128 preallocated overlapping blocks in `solids`/`dashSolids`, with shot and body collision
- [x] Reset the launch clock and wall in `beginRound()`; keep the state out of `SnapshotHazards`
- [x] WEAPON SYSTEMS: nose-up top-down fighter display, reticle and three console banks (`FIRE WEAPONS`, `EJECTOR SEAT`, `THRUSTERS`) placed by their aircraft systems
- [x] Custom arena renderers and picker previews for both maps
- [x] Exclude both maps from `isOnlineArena`; no snapshot or guest presentation yet
- [x] Headless probe (`.tmp/two-new-maps-check.ts`): ids/order, arc endpoints, barrier growth, reset, hazard shape, console cover
- [x] `npx tsc --noEmit`, `npm run build`, `npm run bench` and `git diff --check` clean
- [ ] Headed training pass: read the launch arc and stage debris at full size, and fight around the console banks
- [ ] Optional: teach bot nav about the growing wall, or carry its clock in a snapshot if online support is requested

---

## USB HUB arena (2026-11-01)

- [x] Round 300-radius hub with four radial 420×240 drives, a shared dock/extend/out/retract cycle
- [x] Real 230-unit gaps at full extension; a dash can cross during travel but not at full out; no outer wall
- [x] Outward current on extension, inward current on retraction, plus drive-delta carry
- [x] Hub/drive floor checks in `checkFall`, `offFloor` and player ride/current; threat shifts in gauntlet and infection
- [x] Arena renderer and picker preview using the shared USB geometry helpers
- [x] Local-only online filter; infection opening colony and opening sentry pack placed on real floor
- [x] Bot dash landing checks and off-floor recovery steer
- [x] Headless probe (`.tmp/usb-hub-check.ts`): dock/out geometry, gap, both currents, carry, dash crossing, fall
- [x] `npx tsc --noEmit`, `npm run build` and `git diff --check` clean
- [x] Headed training pass: walked onto a drive, rode the extension, checked full inward steering and the return current
- [x] Tuned the cycle to hold out 3.3 s and extend/retract 1.15 s; kept the 95 u/s flow after the control test
- [x] Increased extension to 300 for a 230-unit full-out gap; added the clock to `SnapshotHazards` and guest `NetView`
- [x] `isOnlineArena` accepts USB HUB; host authority covers rides, currents and falls
- [x] Headless guest check: `parseSnapshot` carries `usbT` through to `NetView`
- [ ] Headed gauntlet/infection pass: threat ride/push readability and bot island use
- [ ] Two-client playtest: verify drive sync, reconnect/rematch and a guest dash into the open gap

---

## SWIPE RIGHT arena (2026-11-01)

- [x] Tall phone-screen arena id 16 with eight emoji profiles, alternating swipe beats and a raised match popup
- [x] Host-side carry of players, projectiles, bots, gauntlet threats, drone and props; wall/solid clamping
- [x] Periodic popup added to body/projectile collision and removed when it falls; caught bodies displaced out
- [x] `SnapshotHazards` carries `swipeT`/`swipePopupT`; guest `NetView` and predictor consume them; legacy wire shape kept readable
- [x] Phone renderer, warning state, app card deck and picker preview
- [x] Headless probe (`.tmp/swipe-right-check.ts`): swipe carry, popup activation/displacement/removal, snapshot and guest clocks
- [x] `npm run build`, `npm run bench` and `git diff --check` clean
- [ ] Headed pass: card framing, swipe readability and popup warning at camera zoom
- [ ] Two-client playtest: verify guests see the same swipe/popup and cannot predict through the raised popup

---

## SATELLITE arena (2026-11-01)

- [x] Arena id 17: five-plate floor union (hull, two solar wings, two bridges), real space falls and a telescoping mast
- [x] Independent solar wing cycles with warning/hot states, damage ticks and renderer treatment
- [x] Telescoping mast as moving cover and a standing-body lift, with collision and placement safeguards
- [x] Periodic micro-meteor showers: seven rocks, 0.9 s warning, 48-unit impact and 1 damage
- [x] Three mounted capacitor props (hp 4) that use prop damage but cannot be launched or thrown
- [x] All-pods-destroyed trigger: 5 s thruster fuse, 14 s bottom-up heat front, 2.5 s top hold, 5 s cooldown and pod restore
- [x] Bot nav bakes the five floor plates; drone, pickups, threats and props stay on authored floor
- [x] Online support: `SnapshotHazards` carries the solar/telescope clock, thruster fuse, reentry clock, heat front, live meteors and capacitor flags
- [x] Guest `NetView` derives solar/telescope/reentry presentation; `LocalPredictor` adds the extended mast as dynamic cover
- [x] `isOnlineArena` accepts SATELLITE; host authority still owns solar/meteor damage, capsule breaks, mast carry and reentry hits
- [x] Headless probe (`.tmp/satellite-check.ts`): solar, meteor, mast, capacitor trigger, reentry and reset timing
- [x] Guest snapshot probe (`.tmp/satellite-net-check.ts`): hazard fields, meteor/capacitor mirror and mast prediction
- [x] `npx tsc --noEmit`, `npm run build`, `npm run bench` and `git diff --check` clean
- [ ] Headed camera pass: solar readability, mast lift feel, meteor warning and reentry wash
- [ ] Two-client playtest: verify satellite clocks, meteor impacts, capsule destruction, mast collision and reentry across the room

---

## Balance lab — INFECTION all-program sweep (2026-11-01)

### Tested
- [x] `.tmp/infection-balance.ts`: 585 headless runs per arm (13 programs × 3 non-damaging maps (GRID ZERO / SWITCHBACK / TRANSIT) × 3 styles × 5 seeds), DIGITAL bots, no friendly fire
- [x] Skill arm: same 585 runs with a test-only on-cooldown Y tap while a virus is within 440 units
- [x] PvP reference on the current build: 468 ordered 1v1 games and 260 four-player FFA rounds on CROSSROADS
- [x] Headed Chromium: all 13 programs on GRID ZERO, one run each; normal boot for Probe/Wedge/Fisher/Sweep/Toxic/Aim Bot, live-page restart for the rest

### Found
- [x] Infection base: 70.4% clears; Compress 100%, Wedge/Kaboom 97.8%, Pinball 95.6%, Probe 93.3%, Toxic 91.1%, Sweep 84.4%, Bad Lag 82.2%, Ghost 80%, Atomize 42.2%, Copy Pasta 37.8%, Fisher 13.3%, Aim Bot 0%
- [x] Skill arm: 72.3% clears; Atomize 42.2→93.3% but still ~74 s, Aim Bot still 0%, Fisher 6.7%
- [x] PvP ordering does not transfer: 4P top Atomize/Aim Bot are infection 10th/13th; 4P bottom Wedge/Bad Lag are infection 2nd/8th
- [x] Headed direction matches: 11/13 clear, Fisher and Aim Bot fail; one Toxic restart failed but the normal boot cleared

### Next
- [ ] Human infection pass on Aim Bot, Fisher, Atomize and Copy Pasta; separate pilot limits from kit limits before tuning
- [ ] Decide whether infection-specific kit changes are warranted; do not use health as the knob
- [ ] Make the gauntlet autopilot use each program's Y skill before treating bot clear rates as full-kit balance

---

## v0.1.105 — KEYPAD fills the frame (2026-11-01)

### Built
- [x] KEYPAD bounds are now exactly the 2400×2640 housing: no exterior floor, side room or spawn gutter
- [x] Caps scaled to 680×528; the 0 spans 2160; key face raised to 156px and the cap details scaled with it
- [x] Spawns moved onto the housing bezel, clear of every cap; all eight remain inside the bounds
- [x] Cycle slowed to 30 s: 4 s warning, 1.2 s sink, 8 s down, 1.6 s rise, 3 s stagger
- [x] Cap travel scaled to 7.5% of key height (~40 units), with a slower warning pulse and larger hazard bars
- [x] AGENTS D36, GAME_GUIDE, TODO and build stamp 0.1.105

### Verification
- [x] `.tmp/keypad-check.ts`: 2400×2640 pad = bounds, 680×528 keys, 8 bezel spawns clear, all five states, 4 s warning, 1.2 s sink, crush at 4.02 s
- [x] `npx tsc --noEmit`, `npm run build`, `git diff --check` — clean; build 736.55 kB / 205.47 kB gzip with the existing chunk-size warning

### Next
- [ ] Human pass on KEYPAD: judge whether one screen-filling key is too close at normal camera zoom, and whether the 4 s warning gives a fair exit from a cap

---

## v0.1.104 — KEYPAD is the arena (2026-11-01)

### Built
- [x] KEYPAD bounds are now 1100×1160: the 900×960 housing plus a 100-unit perimeter spawn gutter, with no outer side room
- [x] Caps scaled to 250×198 (the 0 spans 802) and the digit face enlarged to 68px
- [x] Cycle slowed from 6.2 s to 12 s: 1.4 s warning, 0.45 s sink, 3 s down, 0.7 s rise, 1.12 s stagger
- [x] Renderer interpolates cap travel from `keypadKeyPhase`; warning pulse and hazard bars also slowed
- [x] Spawns stay in the gutter; AGENTS D36, GAME_GUIDE, TODO and build stamp 0.1.104

### Verification
- [x] `.tmp/keypad-check.ts`: 10 keys, 900×960 pad in 1100×1160 bounds, 100-unit gutter, all five states, 0.45 s sink, crush at 1.40 s
- [x] `npx tsc --noEmit`, `npm run build`, `git diff --check` — clean; build 736.34 kB / 205.38 kB gzip with the existing chunk-size warning

### Next
- [ ] Human pass on KEYPAD: judge the pad scale, the 100-unit gutter and the 1.4 s warning; tune only the gutter or warning if the room reads cramped or unfair

---

## v0.1.103 — Dash respects solid cover (2026-11-01)

### Built
- [x] Dash collision uses a cover-only list: floor gaps are cleared and enemies are passed through, but solid cover and sealed cell bars stop both dash kinds
- [x] Deployed Wedge walls, keypad caps and browser page cards no longer phase; a thin wall uses the approach side so a charged dash cannot resolve through it
- [x] Guest `LocalPredictor` builds the same cover-only list; dash movement is substepped at sub-radius intervals so a fast dash cannot skip a thin pillar
- [x] Tutorial/help wording, AGENTS D8/D10/D20/D36/D37, GAME_GUIDE, TODO and build stamp 0.1.103

### Verification
- [x] `.tmp/dash-rule-check.ts` 6/6: pillar stop, charged thin-pillar no-tunnel, gap clear, walking gap stop, sealed campaign bars stop, thin Wedge wall stop
- [x] `npx tsc --noEmit`, `npm run build`, `git diff --check` — clean; build 736.14 kB / 205.28 kB gzip with the existing chunk-size warning

### Next
- [ ] Human dash pass on CROSSROADS, TRANSIT and the campaign cell release; judge whether a stop against solid cover should cancel the committed dash early or leave it pressed against the surface

---

## v0.1.102 — Held wave 2 (2026-11-01)

### Built
- [x] Wave-2 worm and viruses are created with BUILD ROOT and wait behind the bars in `held` state
- [x] Held bodies skip AI, damage, target lock and the normal threat render; caged silhouettes are their presentation
- [x] `beginCellRelease` clears `held` on the existing pool slots; it does not spawn replacements
- [x] AGENTS D41, CAMPAIGN, GAME_GUIDE, TODO and build stamp 0.1.102

### Verification
- [x] Dev browser: 1 held worm (hp 5) and 2 held viruses (hp 1) exist before release; 120 stepped frames left them in place, the player at 3 HP, and no projectiles active
- [x] Damage probes left held HP unchanged; the release gate cleared `held` on the same pool slots, preserved HP, and moved all three bodies over 60 steps
- [x] `npx tsc --noEmit`, `npm run build`, `git diff --check` — clean; build 735.55 kB / 205.09 kB gzip with the existing chunk-size warning

### Next
- [ ] Human playthrough of the release beat and heavy lesson; judge the moment the caged silhouettes become live bodies

---

## v0.1.101 — Holding cell wave gate (2026-11-01)

### Built
- [x] `holdingCellLayout` is shared by the holding renderer and collision; the sealed cell block is one body solid until release
- [x] Six dormant subjects form two columns in holding, all inside the room and clear of the centre entry lane
- [x] Wave 1's skill lesson gates the power-down; wave 2 (two viruses and a worm) gates the heavy lesson and the drill
- [x] Caged worm/virus silhouettes wait behind the bars; `WAVE 01 // SKILL CHECK` and `WAVE 02 // CONTAINMENT RELEASED` banners
- [x] AGENTS D13/D17/D41, CAMPAIGN, GAME_GUIDE, TODO and build stamp 0.1.101

### Verification
- [x] Dev browser: sealed block is 324x108 at (618,346); a northbound body stopped at y=476; release removed the solid and spawned two viruses and the worm inside the cells
- [x] Wave 1 stayed sealed with all six dead until the skill lesson finished; release advanced to the heavy lesson; the drill started only after wave 2 and the heavy beat were clear
- [x] `npx tsc --noEmit`, `npm run build`, `git diff --check` — clean; build 734.46 kB / 204.77 kB gzip with the existing chunk-size warning

### Next
- [ ] Human playthrough to judge wave spacing, the heavy prompt timing, and whether the worm and viruses separate enough before the lesson

---

## v0.1.100 — Pinball flipper art pass (2026-11-01)

### Built
- [x] Three flipper-bat health segments share `pathPinballFlipper` with the deployed skill arm
- [x] A two-flipper melee snap replaces the shared lash while guard and hit rules stay unchanged
- [x] Types 14 and 15 render as solid glossy balls with a shaded lower edge and a fixed top reflection
- [x] AGENTS D4/D31, README, TODO and build stamp 0.1.100

### Verification
- [x] Dev browser: select portrait and live hull, melee pair, small ball and super ball — full-health bats read at card scale and in a 2x live crop; both ball sizes are solid with a fixed top highlight
- [x] `npx tsc --noEmit`, `npm run build`, `git diff --check` — clean; build 732.43 kB / 204.17 kB gzip with the existing chunk-size warning

### Next
- [ ] Judge the hull at couch distance in a match; lengthen the bats if the silhouette is too small

---

## v0.1.99 — BUILD ROOT campaign stop (2026-11-01)

### Built
- [x] `PLAYABLE_CAMPAIGN_LEVELS` makes BUILD ROOT the only live level; REBOOT is authored but parked with `playable: false`
- [x] Campaign access remains `SINGLE PLAYER > CAMPAIGN` → slot → bot count → program → BUILD ROOT
- [x] Level 1 clear saves completed-level progress, marks the slot `COMPLETE`, and shows `MORE LEVELS COMING SOON`
- [x] Completed slots no longer replay or resume REBOOT; they report the coming-soon state
- [x] Clear overlay actions are `STORY SLOTS` and `REPLAY`; the old `NEXT ARENA` path is unreachable while only one level is live
- [x] AGENTS D13/D17, CAMPAIGN, GAME_GUIDE, README, TODO and build stamp 0.1.99

### Verification
- [x] Actual title → campaign → new slot → bot count → program → BUILD ROOT pass — incognito Chrome reached slot 0, `mode: campaign`, phase `calibration`, with the Warden tutorial visible at step 3/10
- [x] Force a cleared BUILD ROOT and verify the save slot, `MORE LEVELS COMING SOON` overlay and completed-slot click — QA-forced clear (assault phase at the kill threshold) wrote `level: 1`, showed `CAMPAIGN // LEVEL 1 CLEAR` / `MORE LEVELS COMING SOON` with `STORY SLOTS` and `REPLAY`, marked slot 1 `COMPLETE`, and the completed slot reported the message without creating a world
- [x] `npx tsc --noEmit`, `npm run build`, `git diff --check` — clean; build 730.15 kB / 203.61 kB gzip with the existing chunk-size warning

### Next
- [ ] Author and test the next playable level, then flip its `playable` flag

---

## v0.1.98 — CRT-head civilians (2026-11-01)

### Built
- [x] Restored a floating CRT shell around the emoji face: rounded housing, inset bezel, dark screen, scan line and power LED
- [x] No body, neck, stand, wheels, arms or legs; the monitor is the whole silhouette
- [x] Carried files sit behind the monitor; dropped papers, mood faces and the local flee behavior are unchanged
- [x] `cart` renamed to `shell`; per-regular screen colours restored
- [x] AGENTS D41/D42, CAMPAIGN, GAME_GUIDE, README, TODO and build stamp 0.1.98

### Verification
- [x] Dev browser: three CRT-head workers and the cat cameo render in holding; carried files read behind the monitors
- [x] `npx tsc --noEmit`, `npm run build`, `git diff --check`
- [ ] Live non-campaign escape pass with the CRT art

### Next
- [ ] Judge screen readability and shell scale at couch distance
- [ ] Decide whether future civilians need a second shell silhouette variant

---

## v0.1.97 — Floating-head civilians (2026-11-01)

### Built
- [x] `regulars.ts` simplified from monitor carts to floating emoji heads with a tinted halo and ground ring
- [x] `ArenaRegularDef.carry` (0–3) draws paper files behind the head; `drawDroppedFiles` leaves a fading stack on the floor
- [x] `RegularMood` and `CIVILIAN_FACES`: calm, scared, angry and sad faces; current workers use their portrait face at rest
- [x] Local renderer flight: live threats inside 230 units make a worker drop files and head for the port, a pad/lift, or the farthest room
- [x] The flight is presentation only; no `Player`, collision, pathfinding, World state or snapshot fields
- [x] Quarantine workers carry one, zero and two files; the wake/destruction beat leaves their papers at the anchors
- [x] AGENTS D41/D42, CAMPAIGN, README, TODO and build stamp 0.1.97

### Verification
- [x] Dev browser: three floating heads and cat cameo render; carried files read; wake hides heads and leaves dropped papers
- [x] Forced fear state: civilians move toward the router port before the scripted loss, with `mood = scared` and carried files already dropped
- [x] `npx tsc --noEmit`, `npm run build`, `git diff --check`
- [ ] Full non-campaign escape pass against a live pack, including safe-room arrival

### Next
- [ ] Judge whether the port-first escape route reads as fleeing, or whether workers should prefer a safe room first
- [ ] Add a generic unnamed civilian row if future arenas need crowd filler without the three named workers

---

## v0.1.96 — Holding tutorial route (2026-11-01)

### Built
- [x] QUARANTINE is now four rooms: intake circle, square holding office with a three-cell block, mainboard rectangle and router rectangle, linked by three bridges
- [x] Holding rendering: cell interiors, barred fronts, script_kitty in the middle cell, office desks and a readable cell-block label
- [x] Three civilian carts (TICKET, PATCH, CACHE) staff holding and disappear on the calibration wake, with a scripted burst at each anchor
- [x] Basic Warden lesson stays in intake; `CALIBRATION_TUTORIAL` asks for skill and heavy while the six subjects are live
- [x] Wake waits for the player to reach holding, with an 18 s fallback; `CALIBRATION.entryWait` is tuning data
- [x] `CampaignPhase.release`: bars flash and open, two viruses and a worm spawn, and only those threats update until cleared
- [x] `campaignBarsFlashT` / `campaignBarsOpen` / `campaignCiviliansLost` are presentation state; no snapshot fields
- [x] AGENTS D13/D17/D41/D42, CAMPAIGN, GAME_GUIDE, README code map, TODO and build stamp 0.1.96

### Verification
- [x] Dev browser: four-room route renders, kitty is behind the middle bars, civilians vanish on wake, bars retract on release and the threat pair spawns
- [x] `npx tsc --noEmit`, `npm run build`, `git diff --check`
- [ ] Headed feel pass on the release fight with a real skill/heavy lesson, not a forced state

### Next
- [ ] Play the full Warden lesson into the release without debug hooks; tune the 18 s entry fallback and the release pair's spacing
- [ ] Decide whether script_kitty should speak from the cell before or after the release

---

## v0.1.95 — Keyboard target lock toggle (2026-11-01)

### Built
- [x] `Q` toggles target lock; releasing it leaves the lock on, and the next `Q` clears it
- [x] Gamepad `LT` remains hold-to-lock; pad lock cycling is unchanged
- [x] Tutorial prompt and control tables distinguish `LT` hold from `Q` toggle
- [x] AGENTS D2, README, GAME_GUIDE and build stamp 0.1.95

### Verification
- [x] `.tmp/lock-toggle-check.ts`: 5/5 checks for initial state, toggle on, release persistence, toggle off, release after off
- [x] `npx tsc --noEmit`, `npm run build`, `git diff --check`
- [ ] Headed feel pass on keyboard lock acquisition and cycling

### Next
- [ ] Judge the toggle through a full keyboard match and confirm the reticle stays readable through target switches

---

## v0.1.94 — Ordinary program carts (2026-11-01)

### Built
- [x] `src/game/regulars.ts`: reusable civilian format — a hovering CRT cart, muted shell colour, dark screen and one emoji face
- [x] Four definitions: TICKET (teal), PATCH (amber), CACHE (violet), PING (rose); unique colours and faces, data row per program
- [x] `drawRegularProgram`: hover bob, ground shadow/ring, cart deck, monitor shell, bezel, scan line, power LED and antenna; no gradients/filters/`shadowBlur`
- [x] `ArenaDef.regulars` placements; three staff the QUARANTINE intake, painted before cover so desks can occlude them
- [x] Presentation only: no `Player` body, collision, health, AI, hit surface or `Snapshot` row
- [x] AGENTS D42, README code map, GAME_GUIDE and build stamp 0.1.94

### Verification
- [x] `.tmp/regulars-check.ts`: four unique definitions, id/colour/face uniqueness, lookup/fallback, three intake placements, all inside the round room and clear of cover/chasms
- [x] Dev browser/console after HMR; campaign boot still resolves `QUARANTINE` and the three placements
- [x] `npx tsc --noEmit`, `npm run build`, `git diff --check`

### Next
- [ ] Human visual pass on the cart scale, emoji readability and whether three carts crowd the intake floor
- [ ] Decide whether story-box speakers get the same monitor frame or stay as floating emoji heads
- [ ] Give regulars a small ambient behavior only if it can stay presentation-only (no `World` bodies or snapshots)

---

## v0.1.93 — QUARANTINE tutorial route (2026-11-01)

### Built
- [x] Arena id 14 `QUARANTINE`: round intake office, mainboard rectangle, larger router rectangle, linked by two bridge decks over four chasm halves
- [x] `ArenaDef.rooms`/`bridges`/`port` plus shared `ROOM_THEME_COLORS`; picker preview and renderer show the same three-room route
- [x] Room dressing: office carpet/cell bars/lamp cones, mainboard traces/chip pads, router port banks/LEDs, animated bridge thread and outbound network-port mark
- [x] `BUILD ROOT` moved to QUARANTINE; spawn 6 opens in intake, six calibration subjects stage in the mainboard, data crates spread through the rooms
- [x] `isOnlineArena` skips room arenas; the port is presentation only and no room state enters `Snapshot`
- [x] AGENTS D8/D13/D17/D41, CAMPAIGN, README, GAME_GUIDE and build stamp 0.1.93

### Verification
- [x] `.tmp/quarantine-check.ts`: 15 checks for id/index, three rooms, bridge/chasm alignment, office spawn, six subjects in the board room, cover/chasm clearance, both crossings walkable, off-deck chasm block
- [x] Dev browser: campaign booted in `QUARANTINE`/`calibration` at `(310,547)`; all six subjects inside the mainboard; no console errors
- [x] `npx tsc --noEmit`, `npm run build`, `git diff --check`

### Next
- [ ] Headed visual pass on the three rooms at combat camera zoom; judge room labels, bridge thread and port readability
- [ ] Decide whether the NETWORK PORT becomes an exit gate (reach it after the clear) or stays the next-node transition
- [ ] Bind script_kitty's lesson to the router room or a later node so all three rooms carry a teaching beat

---

## v0.1.92 — Quarantine orientation + script_kitty (2026-11-01)

### Built
- [x] `src/game/tutorial.ts`: reusable `TutorialRunner`, `WARDEN_TUTORIAL` (move, dash, fire, lock, cycle, melee, reflect) and `KITTY_TUTORIAL` (skill tap, power hold)
- [x] `BUILD ROOT` holds the six calibration subjects dormant until the Warden lesson finishes; skipping ends the lesson and the same wake beat follows
- [x] Reflect lesson arms one slow, harmless test shot from a clear lane; the step completes on the player's first catch
- [x] Second node `REBOOT` on `GRID ZERO`: script_kitty briefing, then breach and a four-kill live-fire check
- [x] Campaign saves now point at the next node; clear overlay offers `NEXT ARENA`; resume starts at the saved level
- [x] Keyboard lock cycling: `R` / `F` while holding `Q`; pad stays `RB` / right stick
- [x] Live DOM story box (speaker mark, line, prompt, step count, SKIP TUTORIAL); local-only and never pauses the sim
- [x] AGENTS D13/D17, GAME_GUIDE, README and build stamp 0.1.92

### Verification
- [x] Browser: `BUILD ROOT` opens in `calibration`, Warden box shows, six subjects dormant
- [x] Move, dash, fire, lock and cycle each advance their own step; melee reaches `reflect`
- [x] Guard catches the test shot, `awake` plays, six subjects wake and the fight starts
- [x] script_kitty skill/power flow: world-stepped through skill, power, `kitty-escape` and the breach at 4 kills
- [x] `npx tsc --noEmit`, `npm run build`, `git diff --check`

### Next
- [ ] Judge whether the 3.4 s narration dwell is too slow on a real read-through
- [ ] Author the next node after `REBOOT` and decide whether the story box needs a per-line skip control

---

## v0.1.91 — Local couch multiplayer (2026-11-01)

### Built
- [x] `src/game/localplay.ts`: `LocalSeats` adopts every detected gamepad as P2–P4, writes one `InputFrame` per slot, keeps a 0.9 s disconnect grace and owns per-pad rumble
- [x] `MULTIPLAYER > LOCAL` setup stage: live seat rows, arena grid, start gate (keyboard + one controller)
- [x] Drop-in during a live round: `World.joinLocalPlayer` activates the spare slot, keeps its preassigned kit and spawns at the arena point farthest from the field
- [x] P1 is keyboard-only in local play (`Input.keyboardOnly`); a pad cannot double-drive P1
- [x] Split view, per-seat readiness docks, per-seat hit/tap/guard/heavy/death rumble, local rematch
- [x] AGENTS D11/D18, README, GAME_GUIDE and build stamp 0.1.91

### Verification
- [x] Browser with two injected pads: setup showed P1 keyboard, P2/P3 pads and P4 open
- [x] Start: three active bodies, split slots `[0,1,2]`, P2 moved 104 units from a left-stick push
- [x] Third pad mid-match: P4 joined at a far spawn, split slots `[0,1,2,3]`
- [x] Disconnect aged P3 to disconnected after the grace; reconnect restored the same seat
- [x] `npx tsc --noEmit`, `npm run build`, `git diff --check`

### Next
- [ ] Headed couch pass with real pads on a TV: split thresholds, dock corners and drop-in during a round
- [ ] Decide whether local gauntlet co-op reuses these seats or stays a separate mode

---

## v0.1.90 — Playtest tour and session log (2026-11-01)

### Built
- [x] `?playtest=1`: boots VS BOTS with 3 bots and the saved callsign/program/tier, 3 completed rounds per arena in `ARENAS` order, automatic rotation
- [x] Per-round log: arena, duration, winner, per-player shots/dashes/swings/deflects/skills/heavies/hits/damage/kills/deaths, exact `deflectTelemetry` sources, FPS and sim ms
- [x] Log persisted to `localStorage['deflect.playtest.last']` after every round; completion overlay offers DOWNLOAD LOG / COPY LOG / TITLE
- [x] `?debug=1` exposes `playtestState()` and `playtestLog()`; `leaveToTitle()` clears live tour state
- [x] `PLAYTEST.md` documents the hook and evaluates the no-backend submission proposal
- [x] AGENTS D6, README and build stamp 0.1.90

### Verification
- [x] Browser: START + MAP 1/14 CROSSROADS, three rounds recorded, rotated to GRID ZERO with round 1 logged
- [x] Exported payload: schema 1, header, per-round player/deflect blocks and summary totals
- [x] `npx tsc --noEmit`, `npm run build`, `git diff --check`

### Next
- [ ] Play one complete tour and read the exported log; judge arena pacing and per-program action usage
- [ ] Decide whether the prefilled-issue REPORT path is worth building (see `PLAYTEST.md`)

---

## Future — player playtest submissions (not built)

- [x] Evaluated the PAT-in-URL auto-issue proposal: **rejected** (client-visible credential, account-scoped token, no per-player revocation, issue spam)
- [ ] Prefilled GitHub issue + downloaded JSON attachment, plus `.github/ISSUE_TEMPLATE/playtest.yml`; `REPORT` on the completion overlay
- [ ] Optional anonymized export (`P1`–`P4`) and a local reader that aggregates a folder of logs
- [ ] If automation is ever required, use a small server-side relay that holds the credential; never ship a token in the client

---

## v0.1.89 — 4-player kit tuning + reflection telemetry (2026-11-01)

### Built
- [x] `.tmp/duel4.ts`: balanced four-program lobbies, seat rotation, 260 rounds per seed, per-program placement, damage, shots, lashes, skills, heavy attempts, guard time and exact catch sources
- [x] `World.deflectTelemetry` (QA-only, never in `Snapshot`) separates guard, lash, beam, atom, net, pinball arm, plow, broom and legacy wave catches
- [x] Atomize: shield balls 3→2, refill 11→18 s, electron 1→0.72, cadence 0.38→0.46
- [x] Aim Bot: rail 8→5 damage, reload 2.0→2.8 s; still deletes a three-segment hull but leaves a six-segment hull on one segment
- [x] Ghost: cloak 3.5→3.2 s, scare window 3.2→3.0 s, cooldown 9→11 s
- [x] Bottom-half buffs: Wedge shot 1→1.25 / 800→860 / .52→.46; Fisher net 15→18 / 6→7 / lure 300→330; Sweep broom 600→650 / .85→.95; Toxic venom .34→.4, spray .5→.7, jet .3→.38; Kaboom bomb 330→360 / 1.9→2.0, blast 58→64, cadence .78→.72; Bad Lag hourglass 1.5→1.75 / 700→740, fast-forward 3.4→3.8; Copy Pasta file 1→1.2, clone 8→9; Probe mine blast 1→1.25, trigger 58→64
- [x] Updated AGENTS D10/D14/D15/D16/D21/D25/D26/D34, GAME_GUIDE and build stamp 0.1.89

### Verification
- [x] Baseline 260-round 4P FFA, two seeds: Atomize 67.5/66.3%, Aim Bot 46.3/48.8%, Ghost 30.0/43.8%, Wedge 8.8/13.8%
- [x] Final same harness: Atomize 50.0/50.0%, Ghost 47.5/47.5%, Aim Bot 35.0/36.3%, field otherwise 8.8–33.8%
- [x] Reflection baseline: 3,856/4,417 catches across 260 rounds; 58.6/58.5 per 100 shots; 90/89% of player-rounds; 14.8/17.0 catches per round
- [x] Final pass: 54.7/56.0 shield catches per 100 shots; 89/90% of player-rounds; 16.0/17.0 all catches per round
- [x] `npx tsc --noEmit` clean; `npm run build` clean: 688.57 kB JS / 190.14 kB gzip; `git diff --check` clean
- [ ] Human four-player pass; judge whether Atomize/Ghost still lead and whether six-segment hulls need a separate 4P compensation decision

### Next
- [ ] Run a headed 4P FFA and confirm guard/reflect reads and heavy visibility
- [ ] Decide whether bot heavy pacing should be shortened for balance sampling; do not infer human heavy usage from it

---

## v0.1.88 — Arena hazards online (2026-11-01)

### Built
- [x] `Snapshot` index 13: compact hazard block with compactor/keypad/scanner/browser clocks, page indices and live file boxes
- [x] Guest `NetView` derives arm pose, key states, scan phase, forum cursor/click and prop presentation; host keeps every hazard hit
- [x] Guest predictor collides with active key caps and browser page cards, and carries with the descending compactor plate
- [x] `RECYCLING BIN`, `KEYPAD`, `DOCUMENT SCANNER` and `BROWSER` rejoin the online arena pool
- [x] Pipes and the firewall switch stay local because their spawned threats and sweep are not in `Snapshot`
- [x] AGENTS D36/D37/D38/D40 and §8, README, GAME_GUIDE and build stamp 0.1.88

### Verification
- [x] `.tmp/hazard-check.ts`: clock round-trip, derived states, NetView mirror, page advance and live props pass
- [x] Heaviest hazard block 180 B packed with 7 live boxes; clock-only maps 16 B; +5.4 KB/s per guest at 30 Hz
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` clean: 687.87 kB JS / 190.00 kB gzip; existing >500 kB warning only
- [ ] Two-client online pass on each newly eligible map; judge compactor carry prediction and page-swap fairness

### Next
- [ ] Run one online match on each newly eligible hazard arena with two real clients
- [ ] Re-measure the full 8P/48-projectile snapshot with a hazard block before raising the 8-player cap

---

## v0.1.87 — Bad Lag: three segments, time-kit tuning (2026-11-01)

### Built
- [x] Reverted the v0.1.81 experiment: Bad Lag is back to the standard **three** health segments; no other health pool changed
- [x] Hourglass: 580→700 speed, 1.7→2.1 s life, 1→1.5 damage, 4→5 bodies, 0.56→0.45 s cadence, 12→9 cost
- [x] Fast-forward: 2.6→3.4 s, 2.5×→2.8×, skill cooldown 10→7.5 s
- [x] Time dilation: 5→6.2 s, 0.3×→0.25×, 0.6→0.45 s charge, 9→7.25 s cooldown
- [x] Bad Lag bots use its actual hourglass speed/TTL for lead and engagement range instead of the generic bolt
- [x] Recorded the global rule: health is an identity budget, not a balance knob; tune speed/timing/damage/cooldowns instead
- [x] Updated AGENTS D4/D6/D10/D21 and §6, tuning README, GAME_GUIDE and build stamp 0.1.87

### Verification
- [x] `.tmp/badlag-tune.ts` asserts HP 3 and runs the duel + gauntlet sweep
- [x] Three-segment baseline: 20.8% duels, 89.0 s average gauntlet, 6.0 kills
- [x] Final package: 34.7% duels, 96.5 s average gauntlet, 8.3 kills in the same harness
- [x] Full `.tmp/balance.ts duels 0`: Bad Lag 36.1% (baseline at three segments was 23.6%)
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` clean: 682.42 kB JS / 188.45 kB gzip; existing >500 kB warning only
- [ ] Human pass on Bad Lag at three segments; judge whether the 1.5-damage hourglass and longer time windows feel fair

---

## v0.1.86 — Series games (2026-11-01)

### Built
- [x] `src/game/series.ts`: 1/3/5 game lengths, random/fixed map rules, no-repeat map picking and tie-aware series winner
- [x] VS BOTS: series setup after difficulty, with `GAMES: 1/3/5`, `MAPS: RANDOM/FIXED`, per-game scores and `NEXT GAME`
- [x] Online versus: host-owned `SERIES` and `MAPS` lobby rules carried in `LobbyState` and `START`; guests follow the host between games
- [x] Random maps draw from the eligible pool without immediately repeating; fixed maps use the setup/lobby arena
- [x] Training, gauntlet, campaign and infection remain single-run modes; series state stays out of `Snapshot`
- [x] AGENTS D39, README/GAME_GUIDE explanations, TODO and build stamp 0.1.86

### Verification
- [x] `.tmp/series-check.ts`: lengths, map normalization, no-repeat selection, fixed arena and tie detection pass
- [x] `npx tsc --noEmit` clean
- [x] Focused browser check: PROBE → CROSSROADS → 1 V 1 → MEDIUM reaches the series stage with all three game lengths
- [x] `npm run build` clean: 682.36 kB JS / 188.42 kB gzip; existing >500 kB warning only
- [x] `npx tsx .tmp/browser-check.ts` still passes after the menu/net changes
- [ ] Human pass on a 3-game bot series and a 3-game online room; judge map variety and the between-game panel

---

## v0.1.85 — BROWSER arena (2026-11-01)

### Built
- [x] New `BROWSER` arena (id 13): a browser-window frame around a forum, with a solid chrome band and scrollbar
- [x] Four forum pages (index, thread, post 7, locked archive), each with a different solid card layout
- [x] A giant cursor idles, seeks the page link, hovers, click-slams for one segment plus knockback, then navigates deeper
- [x] Active page cards are dynamic cover for bodies, threats, projectiles, bombs, beams and blast line of sight; bots steer around them
- [x] Local-only: `onlineArenaIndex` skips the browser, and page/cursor/click state never enters `Snapshot`
- [x] Minimap and picker preview show the browser chrome/page; build stamp 0.1.85 and docs (AGENTS D38, README, GAME_GUIDE)

### Verification
- [x] `.tmp/browser-check.ts`: four pages, all five cursor phases, click at 5.07 s, page 1, page card pushes out
- [x] `npx tsc --noEmit` clean after the dynamic page/cursor integration
- [x] `npm run build` clean: 676.59 kB JS / 186.70 kB gzip
- [ ] Human pass on the browser in training and gauntlet; judge cursor readability and whether page swaps feel fair

---

## v0.1.84 — DOCUMENT SCANNER arena (2026-11-01)

### Built
- [x] New `DOCUMENT SCANNER` arena (id 12): a large glass platen with a central 1254×758 document bed
- [x] Sheets load from the bottom slot, scan top-to-bottom in 3.2 s, snap back in 0.6 s, unload, and replace
- [x] Read line damages players for one segment and threats for three, once per pass per body; dashes phase it
- [x] Document titles, redaction bars, revision stamps and the feed slot are local presentation only
- [x] Local-only: `onlineArenaIndex` skips the arena, and scanner phase/page never enters `Snapshot`
- [x] Minimap and picker preview show the platen; build stamp 0.1.84 and docs (AGENTS D37, README, GAME_GUIDE)

### Verification
- [x] `.tmp/scanner-check.ts`: six documents, all five phases, line inside 120..878, first hit at 2.63 s
- [x] `npx tsc --noEmit` clean after the scanner/interface integration
- [x] `npm run build` clean: 662.44 kB JS / 183.02 kB gzip
- [ ] Human pass on the scanner in training and gauntlet; judge warning readability and whether the return is too punishing

---

## v0.1.83 — KEYPAD arena (2026-11-01)

### Built
- [x] New `KEYPAD` arena (id 11): a central 3×4 ten-key phone pad with digits 1–9 and a wide 0
- [x] Keys cycle warning → slam → solid cover → rise; offsets stagger the ten caps into a rolling pattern
- [x] Slam crushes threats instantly and takes three health segments from a caught player
- [x] Down/slam/rise caps block bodies, projectiles, beams and line-of-sight; dashes still phase them
- [x] Bots steer around warning and down caps; minimap and picker preview draw the pad
- [x] Local-only: `onlineArenaIndex` skips the arena, and no key state enters `Snapshot`
- [x] Build stamp 0.1.83 and docs (AGENTS D36, README, GAME_GUIDE)

### Verification
- [x] `.tmp/keypad-check.ts`: 10 keys, all five states seen, key 0 crush at 0.80 s
- [x] `npx tsc --noEmit` and `npm run build` clean
- [ ] Human pass on KEYPAD in training and gauntlet; judge whether the slam warning is readable at combat speed
- [ ] Watch bot behavior around a pad with several keys down; tune avoidance only if routes pin on the bezel

---

## v0.1.82 — Attract pilot uses power attacks (2026-11-01)

### Built
- [x] The gauntlet/attract pilot commits to the program heavy when a clean target sits 110–440 units away; Fisher gets the longer net hold
- [x] Wedge's plow is now exercised in the demo loop instead of only in player-target duels

### Verification
- [x] Before: 0 plows across 60 headless demo-style runs; all visible `CANDLE` starts were Wedge's wall skill
- [x] After: 13 plows / 18 hits in five CROSSROADS wave-8 runs, and 5–13 plows per five-run cell at waves 8/24/72
- [x] Timed probe: 0.567 s charge, 0.517 s active, hit landed at 220 units; plow timing left unchanged
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` clean
- [ ] Human capture of the attract loop to judge whether the plow reads clearly at wave 72

### Aim Bot audit (2026-11-01)
- [x] 300 s all-map gauntlet: capped 8/11 maps; failed on THE LEDGE (wave 9, 256 s), RECYCLING BIN (wave 1, 10.5 s) and NETWORK SWITCH (wave 6, 160 s)
- [x] PvE kill efficiency is high: 47 kills on CROSSROADS/GRID ZERO, 56 on SPACE CADET; above map average on 7/11 maps
- [x] Close duels: 73.6% DISK PLATTER, 77.8% THE RING, 62.5% SPACE CADET; never the top close-range program
- [x] Added the compactor guard to the new gauntlet heavy branch; RECYCLING BIN still wipes all non-Wedge pilot programs on the first stroke, so it is a map/pilot hazard, not Aim Bot-only
- [ ] Decide whether Aim Bot's PvE clear efficiency is intentionally elite; do not trim it as a close-range problem

---

## v0.1.81 — PvE map sweep, hazard-aware pilot, Bad Lag durability (2026-11-01)

### Built
- [x] Balance harness accepts map id/name/`all`, labels hazards, reports map averages and tests wave starts through 24
- [x] Bot nav blocks static floor voids; idle drift and chase route through hazard avoidance; emitter lanes get a wider away-steer
- [x] Bad Lag gains a fourth health segment (eight clock faces) after raw hourglass tuning proved flat for survival
- [x] NETWORK SWITCH pipe first 2.2→3.4 s and interval 7.4→8.6 s; the Network-specific fixture is the only map tuning
- [x] Build stamp 0.1.81 and docs (AGENTS D6/D10/D21, GAME_GUIDE, tuning README)

### Verification
- [x] 11-map × 13-program gauntlet sweep at a 300 s cap; after pilot hazard fixes THE RING averaged wave 10.7 and RECYCLING BIN 8.2
- [x] Bad Lag clean-map survival wave 5→7, BIN 5→10, and duel win rate 15.3%→20.8%
- [x] Network pipe timing raised its map average wave 7.7→9.8 with 9/13 programs reaching the cap
- [x] Wave samples through 24 showed families arriving on schedule; no wave-composition change made pending human playtests
- [ ] Human pass on RECYCLING BIN (Probe/Wedge/Toxic still die at wave 3) and the new four-segment Bad Lag hull
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` clean

---

## v0.1.80 — Probe's trap mine and cancelable beam (2026-11-01)

### Built
- [x] `MINE` is persistent: no fuse; it arms after 0.55 s and waits until a hostile enters the 58-unit trigger
- [x] Blast radius 82→132, knockback 760→900; one owner keeps at most 3 live mines, and a fourth retires the oldest
- [x] Probe charge 0.63→0.45 s; releasing the heavy while the beam is live cuts it short, ends the root and starts the 5 s cooldown
- [x] Mine renderer shows the enlarged blast ring and no fuse countdown
- [x] Build stamp 0.1.80 and docs (AGENTS D10, GAME_GUIDE, tuning README)

### Verification
- [x] `.tmp/check-probe-mine.ts`: 11/11 (persistent mine, trigger, 100-unit blast hit, 3-mine cap, shortened charge, release cancel and cooldown)
- [x] `.tmp/check-reflect-all.ts`: 26/26 (guard and lash reflection on all 13 roster programs)
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` clean
- [ ] Human playtest of trap placement and release timing

---

## v0.1.79 — Reflected shots keep flying and stack damage (2026-11-01)

### Built
- [x] `BOLT.reflectTtl` 30 s; every catch resets the projectile fuse instead of keeping the short TTL
- [x] Confirmed +1 damage per catch (`BOLT.damage + proj.deflects`) on guard, lash, bash, net and Pinball arm
- [x] Speed still gains 1.4x per catch, capped at `BOLT.maxSpeed` 2800
- [x] Bombs 8/9 remain unreflectable
- [x] Build stamp 0.1.79 and docs (AGENTS D10, GAME_GUIDE, tuning README)

### Verification
- [x] `.tmp/check-reflect.ts`: 10/10 (fuse reset, +1 damage, speed gain, survival past the 0.45 s TTL, bomb exclusion)
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` clean
- [ ] Boss-fight pass on long-lived returns (deferred by design)

---

## v0.1.78 — Bot balance pass: duel matrix and wave pressure (2026-11-01)

### Built
- [x] Aim Bot rail: 2000 speed, 1.6 s life, 2.0 s reload (was 3200 / 20 s / 1.65 s); damage stays 8
- [x] Atomize: 0.38 cadence, 380 seek range, 2.4 turn, 11 s shield cooldown
- [x] Kaboom: 330 bomb speed, 58 blast, 0.78 cadence
- [x] Bad Lag: 580 hourglass speed, 4 body hits, 0.56 cadence
- [x] Wedge: 800 string speed, 0.5 s string life
- [x] Gauntlet: worm/virus intervals 34→28 s, virus cluster 4→5, sentry interval 30→26 s
- [x] Build stamp 0.1.78 and docs

### Verification
- [x] `.tmp/balance.ts`: 72-game duel matrix (3 samples per ordered pair, HARD bots, CROSSROADS)
      final: Atomize 79.9%, Aim Bot 72.9%, Pinball 60.4%, Compress 57.6%, Fisher 54.2%, Ghost 54.2%,
      Copy Pasta 50.7%, Sweep 45.8%, Probe 43.1%, Toxic 40.3%, Wedge 34.7%, Kaboom 32.6%, Bad Lag 23.6%
- [x] Harness correction: both duel bodies are AI-owned (`botSlots` 1), so their 0.8x projectile speed
      matches the lead calculation; the first matrix ran slot 0 at full speed
- [x] Outlier movement across the pass: Aim Bot opened at 24-0 in the single-sample pass and lands at
      72.9% over 72 games; Atomize 87.5→79.9%, Kaboom 22.2→32.6%, Bad Lag 15.3→23.6%
- [x] Wave probe (60 s windows at waves 3/6/9/12/15): mid-game pressure now bites; Probe dies at wave 9 and
      Aim Bot at wave 12 in the sampled runs instead of both coasting
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` clean
- [ ] Human playtest of the rail's new travel time and the mid-game gauntlet pressure

---

## Campaign narrative spine — decided 2026-11-01 (not built)

The plan is written into `CAMPAIGN.md`; no runtime work has started.

- [x] Quarantine opening: dev-system quarantine, every roster program pulled by antivirus for retraining
- [x] Cast: 👮 THE WARDEN as quarantine officer, 🐱 friendly guide, User/Users AI antagonist at ROOT
- [x] Narration plays live over the sim, reveals near-instantly, and is skippable
- [x] Campaign setup gets a persisted `STORY BEATS` skip toggle for replays
- [ ] Bottom-screen narration text boxes with floating emoji/Unicode character heads
- [ ] Text box placement against the campaign objective strip at 720p
- [ ] Skip/advance bind that stays clear of the six action jobs
- [ ] Decide one User vs a group of Users at ROOT
- [ ] Decide whether the cat travels with the party on the route plate

---

## v0.1.77 — AIM_BOT.EXE combat knife melee (2026-11-01)

### Built
- [x] Per-body melee caps (`meleeReachMult`, `meleeHalfAngle`, `meleeKnock`) set with the program
- [x] Aim Bot: 1.5x reach (78 catch / 108 body), 219.6 degree sweep, 980 shove
- [x] Renderer draws the sweep as a bowie blade: grip, cross guard, clipped spine, curved belly, fuller
- [x] Bot melee spacing reads the per-body reach
- [x] Build stamp 0.1.77 and docs (AGENTS D34, GAME_GUIDE)

### Verification
- [x] `.tmp/check-aimbot-knife.ts`: 12/12 (shared lash unchanged, longer reach, wider arc, harder shove)
- [x] `.tmp/check-aimbot.ts`: 17/17 unchanged
- [x] `npm run build` clean
- [ ] Browser pass on the blade shape and sweep read

---

## v0.1.76 — INFECTION: left launch, right tide, swarm groups (2026-11-01)

### Built
- [x] Operators spawn in one left-side line; the opening colony queues beyond the right lip
- [x] All infection virus spawns reuse pooled slots and glide in from the right with the existing build animation
- [x] Entering viruses are exempt from void/disc containment until they cross the floor edge
- [x] `Virus.swarm` adds zero to two fake satellite diamonds; one hitbox, one health, one pool slot
- [x] Swarm count travels to online co-op guests; local and host simulation stay authoritative
- [x] Build stamp 0.1.76 and docs (AGENTS D32, GAME_GUIDE)

### Verification
- [x] `.tmp/check-infection-tide.ts`: 11/11 (left launch, right queue, pooled glide, no culling, swarm density, split re-entry)
- [x] `npm run build` clean

---

## v0.1.75 — SPACE CADET: pinball cabinet (2026-11-01)

### Built
- [x] Arena id 10: tall cabinet, six round posts/kickers, bottom drain, right-wall pinball feed
- [x] Posts reflect shots and shove bodies; kickers launch bodies and speed shots up
- [x] Arcade pipe cycles a hostile file, bouncy ball, virus and sentry; the ball has a real wall/pillar rally
- [x] Renderer, minimap, select preview, bot avoidance and AGENTS D35; local-only, no snapshot fields

### Verification
- [x] `.tmp/check-space-cadet.ts`: 18/18 (layout, furniture, launch, reflection, four pipe beats, ball bounce, drain death)
- [x] `npm run build` clean

---

## v0.1.74 — AIM_BOT.EXE: scope, rail round, sight clip, volley (2026-11-01)

### Built
- [x] Program `AIM_BOT.EXE` (id 12, `SNIPER`): signal red, outer scope ring split into three bracket
      health segments with inward ticks, and a vector twin-ring reticle at the core
- [x] Ranged type 17 rail round: 3200 speed, 8 damage, 20 s practical-no-limit life, no bounce, dies on
      the first body or solid; drawn as a bullet with a long speed tail
- [x] Aim Bot's lock range raised to 2400 through a per-program helper; `lockTX/lockTY` expose the target
- [x] Local camera floor drops to 0.4x base, with a dedicated lock pull that ignores the normal focus cap
- [x] Skill: 7 s visible laser sight and a three-shot clip at 0.16 s spacing that bypasses the 1.65 s
      reload; the clip expires with the sight
- [x] Power: six-target forward cone, red crosshairs, a 0.65 s telegraph, then 12-damage instant hits in
      a 0.06 s row with no projectile
- [x] Bots use rail speed and a 2.4x engagement range; local-only, no snapshot fields
- [x] Build stamp 0.1.74 and docs (AGENTS D34, GAME_GUIDE, README)

### Verification
- [x] `.tmp/check-aimbot.ts`: 17/17 (program id, reload, type 17, 8 damage, 3200 speed, 20 s life, no
      bounce, wall death, sight window, 3-shot clip, clip cadence, 2400 lock, camera target, six marks,
      six 12-damage hits, no volley projectile)
- [x] `npm run build` clean

### Next
- [ ] Play a live match as Aim Bot and tune the 0.4x camera floor and the 2400 lock against real arena
      widths; the first concern is the avatar reading too small at the far edge.
- [ ] Judge the six-crosshair telegraph at couch distance; if the red marks vanish into blood/explosion
      colour, widen the ring before shortening the beat.

---

## v0.1.73 — Copy Pasta dash afterimage (2026-11-01)

### Built
- [x] Every real Copy Pasta dash leaves an inert copy at the takeoff point for 1.5 s
- [x] The afterimage takes one hit, never moves or attacks, and uses a free summon slot below the
      fighting skill copy's reserved slot
- [x] Sentries, worms, viruses, the training drone and calibration subjects can target it; its death
      gives no gauntlet kill credit or pickup
- [x] Player target lock skips copies; no snapshot fields were added
- [x] Build stamp 0.1.73 and docs (AGENTS D33, GAME_GUIDE)

### Verification
- [x] `.tmp/check-copy-dash-decoy.ts`: 12/12 (spawn point, 1.5 s life, one health, inert input, separate
      slot from the fighting copy, aggro selection, one-hit removal, no kill credit, second afterimage and
      timed expiry)
- [x] `npm run build` clean

---

## v0.1.72 — NETWORK SWITCH: pipes, hostile files and a firewall starter (2026-11-01)

### Built
- [x] Arena id 9, a walled rectangle with a central switchblock cluster: four destructible feed pipes,
      a west-end firewall plate, and eight spawn points
- [x] Each pipe alternates a hostile file box and a small threat. Hostile files reuse `Prop` physics with
      a `hazard` flag, damage on contact, and one-hit health; later waves can feed a pulse square
- [x] Pipe intake pulls loose files and small threats into the mouth. Infection deliberately skips the
      enemy intake so the swarm cannot clear its own meter
- [x] Pipes take player-shot and blast damage, show health on the housing, and stop both emissions and
      intake when destroyed
- [x] Firewall plate triggers one opposite-wall sweep and rearms after 180 s; automatic firewalls stay off
- [x] Local-only fixtures: hosted rooms skip an arena with pipes; no pipe or switch state enters `Snapshot`

### Verification
- [x] `npm run build` clean
- [x] `.tmp/check-network-switch.ts`: 14/14 (four live pipes, file feed, hazard damage, intake catch,
      shot damage, all-pipe destruction stopping files, switch sweep and long cooldown)
- [x] Browser smoke: `NETWORK SWITCH` selected and launched, four pipes live, three hostile files on the
      floor after 13 s, no console errors

---

## v0.1.71 — INFECTION online co-op (2026-11-01)

### Built
- [x] Lobby `MODE: VERSUS / INFECTION` toggle, host-owned and mirrored to guests in the lobby packet
- [x] Host infection world keeps every connected operator on the roster, spreads the opening 24-virus
      flood around their spawns, and retargets the colony at the nearest live runner
- [x] Infection snapshots carry the shared clear meter, clock, kills and compact virus rows; `NetView`
      renders and interpolates the colony while the host owns all movement and contact
- [x] A downed operator remains a spectator; the run fails only when no runner is alive. Host retry
      rebuilds the world and broadcasts `REMATCH`; guests get a leave action
- [x] Build stamp 0.1.71 and docs (AGENTS D9/D32, README, GAME_GUIDE)

### Verification
- [x] `npm run build` clean (613.78 kB JS / 170.20 kB gzip; 48.60 kB CSS / 10.90 kB gzip)
- [x] `.tmp/check-infection-coop.ts`: 21/21 (roster, shared flood, nearest-target setup, spectator death,
      last-runner failure, snapshot readout, virus placement, rematch clear)
- [x] `.tmp/check-infection.ts`: 19/19 solo regression
- [x] Live PeerJS harness: lobby mode and `START` mode round-trip, a real guest joins slot 1, and the
      snapshot carries 2 players, 24 virus rows and a 1.5 s infection clock
- [ ] Visible two-window playtest on production: guest death spectate and host retry

### Next
- [ ] Playtest difficulty with two runners: the opening flood is per-player, so confirm the shared 44 cap
      still leaves enough room to kite rather than turning a split into a stationary crossfire
- [ ] Decide whether the guest should see the host's best time in the result overlay

---

## v0.1.70 — COPY_PASTA.EXE display spelling (2026-11-01)

### Built
- [x] Align the roster display name with the brief's spelling: `COPY_PASTA.EXE`. The internal program key,
      tuning block and probe stay `COPYPASTA`; only the user-facing name changed

### Verification
- [x] `npx tsc --noEmit` clean; `npm run build` clean
- [x] Production select card and How to Play roster read `COPY_PASTA.EXE`

---

## v0.1.69 — COPYPASTA.EXE: chain files, bot copy, redaction (2026-11-01)

### Built
- [x] Program `COPYPASTA.EXE` (id 11, `DUPLICATE`), highlighter-yellow hull of three upright file icons,
      one per health segment, and a vector two-square copy stamp at the core
- [x] Ranged file (type 16): 1 damage, and on a body it tears into two smaller files from 26 units outside
      the victim. Children carry `variant` 1, hit for 1 and never split again; the offset is what makes it
      a chain rather than a guaranteed 3-damage burst on the same body
- [x] Skill: a bot-driven copy on slot 7 for 8 s with 3 health. It writes an ordinary `InputFrame`, fights
      threats in gauntlet modes and other programs in bot matches, trails its owner when idle, and never
      counts as a room body or a round survivor
- [x] Power: 280-unit redaction ring. Enemies in line of sight grow 1–6 little red file icons over 1.6 s,
      then take 2 (players) or 3 (threats) damage. Cover blocks the cast; the mark follows the body
- [x] Readiness dock marks, projectile art, bot skill/engagement band, select card and portrait

### Verification
- [x] `npx tsc --noEmit` clean
- [x] Headless probe `.tmp/check-copypasta.ts`: 19/19 checks (two children, no re-split, one file of
      direct damage, copy spawn/counts/expiry, mark growth, 2 damage, cover block, owner/copy immunity)
- [x] `npm run build` clean (see HISTORY for sizes)
- [x] Live browser: menu card, training with Copy Pasta, copy spawn on slot 7, redaction 1→3 icons and
      detonation for 2, no console errors

### Next
- [ ] Human playtest and balance pass on the chain, the copy's 8 s window and the redaction damage
- [ ] The new arena is still blocked on a layout brief (name, floor/cover, mechanic)

---

## v0.1.68 — INFECTION: a timed swarm clear (2026-11-01)

### Built
- [x] New solo mode `SINGLE PLAYER > INFECTION`, entered as program → arena → run (no bot or setup
      stage). It runs on the gauntlet simulation with `World(..., infectionMode=true)` and keeps the
      `gauntlet` mode string, so no threat, camera or network branch forks
- [x] Opening flood of 24 viruses around the player on a 260–620 ring, with a dedicated 44-body pool
      (the gauntlet keeps 10). The colony buds one body every 1.6 s up to the cap and hunts across the
      whole floor at 1.16x speed instead of holding the usual 310-unit patch
- [x] Top-centred **VIRUS CLEARED** meter with percentage and run clock; progress is
      `kills / (kills + live)`, capped at 99% while anything lives, so a split visibly sets it back and
      only an empty floor reads 100%
- [x] The swarm bites instead of charging: the single-target lunge is off in this mode (16 simultaneous
      committed charges killed a standing player in three seconds), contact deals 1 and a 540 shove, and
      a shared 0.85 s grace stops a packed frame from stacking a kill. The gauntlet's infection meter
      and thrall spawn do not run here
- [x] No pickups, no kill drops and friendly fire forced off, so a best time cannot come from a random
      roll or the colony thinning itself. Arena emitters and floor hazards still run
- [x] One life: a broken ring sets `infectionFailed`; a clean sweep sets `infectionCleared`; both use the
      existing gauntlet freeze and death-hold before the results overlay
- [x] `src/game/infectionRecords.ts`: one best time per arena under `deflect.infection.bests` in `m:ss.d`.
      Failed runs are never recorded; the title menu shows the fastest clean sweep
- [x] Results overlay (clear shows time, kills, percent and best; fail shows percent and kills) with
      RETRY / ARENA / TITLE; `?infection=1&bot=1` is the QA autopilot hook
- [x] Docs: AGENTS D32, GAME_GUIDE mode section, README mode and code map, this entry

### Next
- [ ] Playtest the first clear on CROSSROADS and DISK PLATTER; tune opening count, growth interval and
      the 0.85 s bite grace before touching the virus pool cap
- [ ] Decide whether the colony should bud faster as the meter climbs, or whether a flat 3.2 s is the
      right pressure
- [ ] Watch a full clear with the autopilot at couch distance and confirm the top meter reads without
      stealing attention from the swarm

---

## v0.1.67 — Menu music: a quieter bed on every menu screen (2026-10-31)

### Built
- [x] One scheduler, two beds: `startMusic(mode)` runs the 82 BPM match loop or a 62 BPM menu loop with the
      same changes, no drums, one held pad per bar, a soft bell and `MENU_BUS_TRIM` 0.6 on the music bus
- [x] `startMenuMusic()` plus `setScreen` wiring: entering a session stops the bed, every other screen starts
      the menu one; `unlockAudio` brings it up on the first gesture outside a session
- [x] `?debug=1` exposes `audio` beside the renderer/world handles so the mix can be measured in place
- [x] Build stamped 0.1.67 (`index.html`, `main.ts`, `sw.js`, `package.json`, lockfile)

### Next
- [ ] Audition the handoff: title → program select → match → title, with no gap and no double bed
- [ ] Decide whether the attract/demo kiosk keeps the match bed instead of the menu one

---

## Sound: music mix (2026-10-31)

### Fixed
- [x] Music bus 0.24 → 0.5 (`MUSIC_BUS_LEVEL`) with per-voice gains raised to match; the chord bed used to
      sit near −59 dBFS, about 31 dB under a single bolt
- [x] Sustained `pad()` envelope for the chords and bass roots, so the loop has body in the range laptop
      speakers reproduce instead of half-second stabs
- [x] Verified the program picker needed no change: 11 cards share one size and one outline, `.selected`
      is a dot plus dim border, the cursor owns the bright ring

### Next
- [ ] Listen at the default 65 % soundtrack on the laptop's own speakers and confirm the hats survive;
      lift 6–8 kHz instead of the whole bus if they vanish
- [ ] Decide whether menus and the attract demo should carry music: today the loop starts with a match
- [ ] Remember mute is persisted (`deflect.muted`): a stray `M` silences everything until it is toggled

---

## v0.1.66 — PINBALL.EXE: ricochet ball, flipper arm, giant ball (2026-10-31)

### Built
- [x] Roster entry 10 (ricochet): cabinet blue `#4d8bff`, circular three-arc hull, vector circled-X core,
      text glyph `⊗`. The mark is drawn at every size, so it never falls back to a font glyph
- [x] Three stored dash charges (`Player.dashMax`) and a shield that is 1.85x longer and 1.65x wider
      (`guardMax`/`guardReach`); respawn and the dock both read the per-body caps
- [x] Ranged: type 14 ricochet ball, 520 u/s, 4.2 s, 24 bounces, speed +10% per wall/pillar/barrier and
      +8% per body (cap 1480). Damage ladder 1-2-3-4-5 over five bodies, one pass each
- [x] Skill: flipper arm planted in front for 16 s, swinging through a 2.3 rad arc. It punts hostile
      shots at the nearest other enemy (1150 u/s) and swats one body per 0.2 s for 1 damage and 1500
      knockback. Cooldown is `BUG.cooldown[13]` = 16 s
- [x] Power: hold 0.7 s for one giant ball (type 15, radius 46, 3 damage, 7 s, 430 u/s). Bounces off arena
      walls only; passes through bodies, cover, webs, props and Wedge walls and rolls over each body once
- [x] Renderer: chrome ball and huge super ball, flipper arm with a pivot life arc, three-charge dock, and
      distinct skill/heavy marks. Bots use the ball range and plant the arm at 90-360 units
- [x] Docs: AGENTS D31 and D4/D10 notes, README roster/QA lines, this entry, build stamp 0.1.66

### Next
- [ ] Play a full VS BOTS set as Pinball and tune the arm's 16 s uptime and 1500 swat shove; if the
      pinned lane decides too much, shorten `armLife` before lowering the shove
- [ ] Watch the damage ladder in a 1v2: confirm the fifth hit lands at 5 damage before the ball retires,
      and that a 24-bounce rally still reads at couch distance
- [ ] Check the super ball on DISK PLATTER and THE LEDGE: it should turn at the rim/lip consistently and
      never trap a body under its 46-unit radius

---

## v0.1.65 — DISK PLATTER: round floor, moving holes, read arm (2026-10-31)

### Built
- [x] New arena id 8: a 690-radius round platter inside square camera bounds, nine authored polar holes,
      and an open rim. World, bot pathing, props, the drone and the camera all read the same floor test
- [x] Holes turn with the platter at 0.075 rad/s. `voidAt` returns the hole under a body, so the existing
      0.6 s fall hang pulls toward it; dashing still clears a hole, landing inside one does not
- [x] Read arm pivots outside the rim and sweeps on an 11.5 s sine. Contact separates the body and leaves
      a tangential 360 shove on players, worms, viruses and sentries; it never damages directly
- [x] Threat containment clamps roaming families to the rim without saving them from holes. Bots steer off
      the rim and the current hole positions, including the idle no-hostile drift
- [x] Renderer: clipped round floor with rotating servo tracks, sector seams and platter arcs, spindle hub,
      cut holes with lit lips, rotating rim ticks and the full read arm. Minimap and picker preview follow
- [x] Online rooms keep the round plate and static holes but park the spin and arm: no disc phase in the
      snapshot. Local training, gauntlet and campaign get the moving floor
- [x] Docs: AGENTS D30, README arena table and QA checks, this entry

### Next
- [ ] Play a full gauntlet wave on DISK PLATTER and check that the arm's shove reads as a shove, not a
      teleport, at couch distance; tune `push` before changing the sweep period
- [ ] Watch three bots fight on the plate for a full round: confirm the hole steer holds under pressure and
      no bot repeatedly walks into the same drifting hole
- [ ] Decide whether a moving-hazard arena needs a snapshot phase before it is offered in an online room,
      or whether the parked plate is the final rule

---

## v0.1.64 — COMPRESS.EXE: pressure orbs, size dash, pressure burst (2026-10-30)

### Built
- [x] Roster entry 9 (pressure): archive orchid `#c46bff`, six health segments drawn as six upright capital
      Zs on an orbiting ring, a vector press (screw, jaw, squashed block, base plate) at the core, and
      text glyph `⊟`. Letters stay upright while the ring turns; rotating them with the ring read as Ns
- [x] Ranged: type 13 pressure orb, 560 u/s, 1.05 s, radius 9, 1 damage, 340 shove, no tail. A hit drops
      the body scale 15% (floor 0.35) and the health cap by the larger of 10% or 1 point
- [x] Cap loss is permanent until respawn for players; sentries and viruses shrink their `radius` directly,
      so draw and hitbox agree; worms carry `shrink` for the drawn chain only; error blocks only lose health
- [x] Skill: `shrinkT` 3.5 s, 1.85x walk speed and an extra 0.62 body fold with a squeeze ring. No iframes,
      no hitbox change, attacks and dashes still work. Cooldown is `BUG.cooldown[12]` = 7 s
- [x] Power: hold 0.6 s for a 230-radius pressure burst that halves size and health caps in the ring and
      crushes anything at 1 health. Cover cuts it, rides and dormant calibration shapes are spared, the
      caster is skipped, and survivors take no direct damage. 8 s cooldown
- [x] Bots hold the burst inside `powerRadius - 30` and tap the sprint to close or leave a 120–420 gap
- [x] Renderer: pressure-orb ring with a down-caret, contracting heavy charge ring with eight inward ticks
      and a faint radius circle, sprint chevrons, dock marks, and a purple squeeze/burst event
- [x] Respawn (`clearPlayerForSpawn`) restores the program segment pool and `shrink = 1`; death clears the
      sprint timer. No snapshot fields; online still runs Probe
- [x] Docs: AGENTS D29 and the D4/D10 roster notes, README controls and QA checks, this entry

### Next
- [ ] Play a full VS BOTS set as Compress and decide whether two orb hits (3 cap → 1) is the right ceiling
      before a target dies from the next chip, or whether the cap cut should be smaller for players
- [ ] Check the six-Z hull at one segment and at the 0.35 shrink floor on a wide arena; confirm the ring
      still reads as a silhouette and not a cluster of loose letters
- [ ] Watch a `?demo=true` rotation that includes Compress and confirm the burst reads at kiosk distance

---

## v0.1.63 — Campaign calibration prologue and kiosk wordmark (2026-10-30)

### Built
- [x] `BUILD ROOT` opens on six dormant calibration subjects: two blue circles, two red triangles and two
      yellow rectangles. They wake together on proximity, on the 6 s timer, or on the first hit; while
      dormant they are invulnerable so the eye-open beat cannot be skipped
- [x] Blue circle: committed dash with a 0.32 s tell, three bounces off walls and cover, one damage per
      dash. Red triangle: never parks, drifting on a wandering heading while a churning cloud of sixteen
      tiny triangles seeks the player (a loose band keeps it near the fight, and it turns off arena walls).
      Yellow rectangle: no spin, light vertical float, clones directly left and right
      into an axis-aligned row, then the whole row dashes together at high speed. All use the sentry pool
      and the normal player weapon hits
- [x] Waking shapes carry a small red eye; the pack deliberately shows no lane, arrow or link lines, so
      the switch into an attack is the read. Clearing all six starts the sparring drill
- [x] Calibration kills pay no score, pickups or assault progress; parents take their children with them;
      arena emitters and the normal gauntlet spawner stay parked until the drill
- [x] `?demo=true` now shows only the `DEFLECT_` wordmark in the title ASCII face, with no mode label or
      subhead, fading on a 60 s cycle. README has a top-of-page demo link and clickable capture
- [x] Kiosk runs rotate one, two and three local pilots (`ATTRACT.squadSizes`). Three-player runs filter
      to compact solid arenas so the whole group stays on one shared pane; squad deaths respawn and do
      not count as kills
- [x] Vite ignores `screenshots/` while watching, so writing a capture into the repo no longer reloads a
      running kiosk session
- [x] README, AGENTS D17/D23 and the build stamp updated; v0.1.63

### Next
- [ ] Play the calibration prologue with a real controller and tune wake radius, layout spacing and the
      circle/triangle/rect cooldowns if the lesson is too crowded or too slow
- [ ] Watch a full kiosk loop through a death and restart on the deployed build and confirm no mode text
      flashes between runs

---

## v0.1.62 — Bots actually guard sentry fire (2026-10-30)

### Built
- [x] The bot threat filter accepts every deflectable projectile type, not only the player bolt type 0.
      Gauntlet sentry bolts and missiles are types 3 and 4, so the old guard and close-swat branches
      never fired in the attract demo
- [x] Guard chance raised from 0.7 to 0.85 and the breather shortened from 1.2–2.4 s to 0.9–1.8 s, so the
      shield is a visible part of the pilot's kit without making it turtle
- [x] A close sentry shot is now swatted as well as a close player bolt; mines, bug walls and bombs are
      still dodged rather than reflected
- [x] Headless wave-72 gauntlet runs for 45 s each (Probe/Sweep/Atomize × 3 seeds): 14–53 reflected shots
      per run and 1.8–6.6 s of guard time; six of nine runs survived. README and AGENTS D6 updated; build
      0.1.62

### Next
- [ ] Watch a full `?demo=true` loop at wave 72 and confirm the shield/deflect flash reads at demo zoom
- [ ] Check that HARD/IMPOSSIBLE bots guarding sentry volleys do not become too defensive in VS BOTS

---

## v0.1.61 — Controller rumble (2026-10-30)

### Built
- [x] `src/game/haptics.ts`: standard Gamepad `vibrationActuator.playEffect('dual-rumble')` with the older
      `hapticActuators[n].pulse` fallback; silent when a pad has no actuator or the keyboard/mouse owns input
- [x] Six cues (`tap`, `guard`, `hit`, `blast`, `heavy`, `death`) plus a 300-unit `blastRadius` in
      `tuning/world.json` under `HAPTICS`; light cues are spaced at least 55 ms apart, death is not dropped
- [x] Wired to a local swing/dash, deflect, heavy beam, nearby explosion, spent health segment and death;
      dormant in attract/kiosk, the stress bench, menus, overlays and the loading intro
- [x] `SETTINGS > FEEDBACK > RUMBLE` persists at `deflect.rumble` and resets with the other defaults;
      `TEST HIT FEEDBACK` proves the connected pad's actuator without taking damage
- [x] `Input.activePad()` returns only the pad that owns input. README, AGENTS D11 and the tuning README
      updated; build stamped 0.1.61
- [x] `npx tsc --noEmit` clean. Browser virtual pad: standard `playEffect` recorded the 180 ms hit cues and
      a 70 ms dash tap; a legacy `pulse` shim recorded 0.55/180 ms; RUMBLE OFF suppressed the test cue and
      ON restored it; a reload kept RUMBLE OFF until it was re-enabled. No physical pad was available

### Next
- [ ] Physical DualSense/Xbox pass: confirm the dual-rumble strengths read on real hardware and check the
      legacy pulse path only if a browser needs it

---

## v0.1.60 — Keep the demo alive through a death (2026-10-30)

### Built
- [x] `World.step` keeps simulating when `gauntletOver` is set **and** `attractMode` is true. The death
      frame no longer freezes the arena for the restart delay
- [x] Real gauntlet, campaign and hosted runs still freeze under their result overlays; only the attract
      and kiosk demos opt out
- [x] The pilot still uses `gauntletOver` as the restart signal, so `ATTRACT.restart` (4 s) is now four
      seconds of live aftermath instead of a still frame. README and AGENTS D23 updated; build 0.1.60
- [x] `npx tsc --noEmit` clean. Browser attract run forced to a death: `gauntletT` advanced 1.5 s and the
      worm/virus positions changed after the ring broke, the world stayed live for the 3 s check, and a new
      demo world existed by 7.5 s. A real `?gauntlet=1` death left `gauntletT` unchanged for 1 s

### Next
- [ ] Watch a full 4 s aftermath repeatedly and check the death camera does not linger on an empty corner
- [ ] Consider a short fade at the new-run cut once the aftermath is proven; the simulation transition is
      fixed first

---

## v0.1.59 — Gamepad Select UI toggle (2026-10-30)

### Built
- [x] `MenuEdges.ui` is a separate Back/View/Select edge. `START` remains the only in-game menu button;
      Select no longer opens the leave overlay by accident
- [x] In play, Select toggles the whole canvas UI for the session, exactly like `?ui=0`. It does not
      rewrite the saved `GAME UI` / `deflect.ui` choice
- [x] In menus and overlays, Select keeps its old back behavior; `B` still backs out too
- [x] HOW TO PLAY gamepad table, README controls and AGENTS D11/§4 record the mapping; build stamped 0.1.59
- [x] `npx tsc --noEmit` clean. Virtual-pad browser run: two Select presses flipped `GAME UI: ON` to OFF and
      back, Start still opened `SYSTEM // PAUSED`, Select closed it without changing the UI, and a reload
      restored the saved ON choice

### Next
- [ ] Physical Xbox/PlayStation pad pass: confirm the View/Select/Share button is index 8 on the user's
      hardware and that the table's `VIEW / SELECT` label matches the pad

---

## v0.1.58 — Threat melee: worm bite, virus charge, sentry ram (2026-10-30)

### Built
- [x] Worms answer a close player with a telegraphed bite: rear, 0.16 s lunge, 1 damage and an 880 shove,
      then recovery. Direction latches at the trigger; cover, a dash or a strafe can make it whiff
- [x] Viruses wind up and straight-line **charge** at 34–150 units for 1 damage and a 540 shove, then
      recover; iframes and cover cancel the hit, not the commitment
- [x] Pulse squares and dart flocks **ram** a player inside 92 units instead of firing; triplex and homing
      silhouettes keep their shooting band. The ram has a 0.3 s wind-up, 0.16 s dash and a recovery beat;
      only one sentry ram commits at a time, so a flock cannot stack three hits on one frame
- [x] Shared render telegraphs: worm jaws open and snap shut on the committed direction; virus and sentry
      lunges draw a dashed guide, a hot dash trail and an impact nose. No new particle system
- [x] All numbers live in `tuning/threats.json` (`WORM.bite*`, `VIRUS.charge*`, `SENTRY.ram`); README and
      AGENTS D9 updated; build stamped 0.1.58
- [x] `npx tsc --noEmit` clean. Headless probes: a worm at 50 units bit for 1 damage; a virus at 100 units
      charged and hit once; a pulse square at 70 units rammed and hit once. `npm run build` clean

### Next
- [ ] Physical playtest of the three tells at gauntlet wave 3+; check that the bite jaw and the ram guide
      still read at the camera's minimum zoom
- [ ] Decide whether a ramming flock should spread its darts on impact (currently it only shoves)

---

## v0.1.57 — Phone touch layout and local input assists (2026-10-30)

### Built
- [x] `src/ui/touch.ts`: a bottom-left DOM stick with a 0.18 deadzone and three hold-capable
      bottom-right buttons. SHIELD is `ACTION.SWING` (tap lash, hold guard), SKILL is `ACTION.CANDLE`
      (tap skill, hold power) and DASH is `ACTION.DASH` (tap dodge, hold charged). Pointer up, cancel,
      blur and a hidden tab release every held touch
- [x] The layer only shows in a live local/guest game with no overlay or loading intro; menus,
      attract/kiosk and the stress bench hide it. GAME UI does not remove it (it is input, not readout);
      the pause button opens the normal leave overlay and STAY restores the controls
- [x] `touchMode` comes from a coarse pointer; `?touch=1` forces it and `?touch=0` suppresses it
- [x] Settings > `CONTROLS`: persisted `AUTO LOCK` (`deflect.autoLock`) and `AUTO ATTACK`
      (`deflect.autoAttack`); both default on for touch and off for keyboard/pad, reset follows the device
- [x] Auto lock holds the normal lock; auto attack writes LOCK and uses `AUTO_ATTACK.meleeRange` /
      `rangedRange` from `tuning/player.json` to choose the lash or ranged fire. It never overrides a
      held manual action, an active swing/guard/dash/heavy or an armed jump-scare
- [x] Touch HUD: readiness docks move to the top centre; the shared minimap is hidden. Stick and buttons
      use safe-area insets. No Touch state enters `World`, `Snapshot` or a room
- [x] `HOW TO PLAY` gets a touch table; README controls and QA hooks updated; build stamped 0.1.57
- [x] `npx tsc --noEmit` and `npm run build` clean. Browser at a 843×390 viewport: stick moved the local
      avatar, guard rose and released, the pause overlay hid and restored the layer, auto lock acquired a
      visible bot, auto attack fired, and `?touch=0` left both assists off

### Next
- [ ] Physical iPhone and Android pass: thumb reach, safe-area spacing, one-handed play, pointer cancel
      when a call or notification takes the page
- [ ] Decide whether touch needs a manual lock-cycle control when AUTO LOCK is off
- [ ] Tune the three touch button positions from real thumbs; the current 2×2 grid leaves the top-left
      cell empty
- [ ] Landscape is the assumed phone pose; portrait is usable but not laid out for it

---

## v0.1.56 — Kiosk demo boot and centered GAUNTLET title card (2026-10-30)

- [x] `?demo=true` (also `1`) boots the existing attract pilot as a permanent, non-interactive kiosk
      loop: random program and arena, wave 72, live-cap refills, restart after a wipe
- [x] Every wake input is ignored in demo mode (keys, pointer, wheel, gamepad edges) and the body hides
      the cursor; there is no pause, menu or exit path
- [x] Centered `GAUNTLET` title card over the arena, above the canvas and below the scanline/vignette
      layers, with `pointer-events: none`; 30 s CSS cycle, 12 s visible then hidden
- [x] `?demo=true` takes precedence over the other boot hooks; no records, overlays, `Snapshot` or
      `NetView` fields, and no settings persistence
- [x] Docs: AGENTS D23, README QA hooks, this entry; build stamped 0.1.56
- [x] `npm run build` clean. Browser: demo boots to a live wave-72 gauntlet with `showUi` false, title
      animation 30 s / `GAUNTLET` centered, Escape leaves it running; the normal attract still exits to
      the hub on Escape

---

## v0.1.55 — A projectile that runs out of range dissolves (2026-10-30)

- [x] `EV.DISSOLVE` (40) emitted when a general projectile's fuse reaches zero without a body or
      cover hit; `power` carries the projectile type and `slot` carries the owner
- [x] `Fx` turns the event into a small shard fizzle: larger shapes (spear, broom, needle, mouth,
      hourglass) leave six pieces, bolts and hostile shots four; hostile fire uses the danger tint and
      player fire uses the owner's program colour
- [x] No shake, flash or sound. A body hit, cover stop, mine detonation or bomb blast keeps its
      existing feedback and never emits `DISSOLVE`
- [x] Event-driven, so an online guest sees the same fizzle from the snapshot event list. No new
      snapshot field or packet shape; the event vocabulary gains one kind
- [x] Docs: AGENTS D5, this entry; build stamped 0.1.55
- [x] `npm run build` clean; headless check confirms a free-flying bolt emits DISSOLVE at TTL and a
      bolt stopped by the training drone does not

---

## v0.1.54 — Arena laser emitters: gather, fire, full-guard return (2026-10-30)

- [x] `ArenaDef.emitters` data plus the first fixtures: CROSSROADS (two cross-lane beams on the central
      blocks), THE RING (top/bottom gates) and MAINFRAME (two mid-map lanes). RECYCLING BIN keeps its
      compactor as the only floor hazard
- [x] `EMITTER` tuning in `world.json`: 2.4 s gather, 0.42 s live shaft, 7 s period, staggered offsets;
      1 direct damage and 420 shove, 2 reflected damage and 620 shove
- [x] `World.updateEmitters` runs only in training/gauntlet practice. A hosted match leaves every fixture
      idle, and nothing enters `Snapshot`/`NetView`
- [x] Direct shaft uses `beamReach` and line of sight, burns a player once per pass and records
      `SRC.EMITTER`; cover stops the draw and the damage on the same surface
- [x] A raised guard facing the lens catches the shaft. The return leaves along the guard's facing (target
      lock aims it at the locked enemy), is one `damageBeamLine` pass and skips the guard
- [x] Renderer: wall bracket and red lens, converging gather dots with radial streaks, layered red shaft,
      muzzle/impact flares, red side sparks, and red emitter studs on the arena preview and minimap
- [x] Placement check: no lane crosses the local start point. THE RING was moved off its side-gate spawn
      pair to the top/bottom gates; MAINFRAME's lanes sit clear of the y=720 spawn
- [x] Docs: AGENTS D27 and the D22/D27 cross-reference, README arena section, tuning README, this entry;
      build stamped 0.1.54
- [x] `npm run build` clean; headless check covers timing, one-hit-per-pass, guard catch and return damage,
      match dormancy, every authored lane and every local start point

---

## v0.1.53 — Friendly fire is a gauntlet/campaign run rule (2026-10-30)

- [x] `World.friendlyFire` (default on) gates enemy-fire damage to worms, viruses and error blocks:
      hostile AI shots and the slot-1 thrall's bolts. Off, they pass through rival threat families and
      only threaten players
- [x] `FRIENDLY FIRE` toggle in GAUNTLET run setup and the CAMPAIGN save-slot stage; the shared setting
      persists as `deflect.friendlyFire` and both stages read it, so a resumed run can change it too
- [x] Only enemy fire is gated. Firewalls stay environmental, worm/virus feeding and player shots are
      unchanged, and sentry packs still ignore each other
- [x] Local-only; no snapshot, networking or renderer change
- [x] Docs: AGENTS D9, README, this entry; build stamped 0.1.53
- [x] `npx tsc --noEmit` / `npm run build` clean; headless check covers on, off and player shots

---

## v0.1.52 — GHOST.EXE: cloak, chomping mouth, jump-scare (2026-10-30)

- [x] Roster entry 8 (stealth): steel-grey `PROGRAM_COLORS.ghost`, three outward arcs (one health segment
      each), a vector closed eye with five lashes, and `bugKind` 11
- [x] Ranged: type 12 chomping mouth at 540 u/s, 2 damage, wide radius, no tail, dies on cover, and dazes
      a body for 0.7 s at 55% movement
- [x] Skill: 3.5 s cloak. `phased()` blocks damage, AI target picks and threat acquisition skip the body;
      the local avatar keeps a dashed cloak readout so the owner can still navigate
- [x] Power: hold `Y` for 0.45 s to arm a 3.2 s jump-scare. Any action press fires the 210-radius,
      2-damage, 1200-knockback burst and stamps the ASCII face; the window can also expire without firing
- [x] Bots: tap cloak under fire, arm the scare at close range, chase and melee once armed; they cannot see
      or target a cloaked player
- [x] Dock and renderer: closed eye for the skill, open maw for the heavy, armed warning ring and burst
      radius for the owner
- [x] Eye orientation corrected after the first pass: the lid is the bottom-half arc with lashes below
- [x] Center marks on the four newest programs scaled down for hull clearance: Kaboom `0.76`, Bad Lag
      `0.72`, Atomize `0.72`, Ghost `0.82`; the select portrait now applies `coreScale` instead of drawing
      every poster mark at full size, and the vector bomb fallback scales with it
- [x] Probe's core and roster mark changed from the target `◎` to a **compass**: a vector housing ring
      and four-point rose (`✥` in text), so the scan-ring program reads as navigation rather than a bullseye
- [x] Toxic needle range extended: `needleTtl` 0.62 → **0.85 s** at the same 880 u/s, so the dart reaches
      about 748 units instead of 546 before it expires
- [x] Docs: AGENTS D4/D10/D26, README controls and QA checks, this entry; build stamped 0.1.52
- [x] `npx tsc --noEmit` and `npm run build` clean; focused headless kit check passes; live select
      screen checked for hull clearance

---

## v0.1.51 — BUFFER_OVERFLOW.EXE renamed BAD_LAG.EXE (2026-10-30)

- [x] Display name changed to `BAD_LAG.EXE`; the kit, palette, hourglass core, clock hull, ranged
      throw, fast-forward and dilation are unchanged
- [x] Internal ids stay put: `PROGRAM_ID.BUFFER`, `BUFFER` tuning, `PROGRAM_COLORS.buffer` and the
      save/select data all keep their existing keys, so old slots still resolve
- [x] Living docs and user-facing prose use Bad Lag; the v0.1.41 TODO/HISTORY entries keep the old
      name as history
- [x] Build stamped 0.1.51; `npm run build` clean

---

## v0.1.50 — Readiness dock keeps dash, skill and heavy only (2026-10-30)

- [x] Drop ranged shot tracking and the pickup cell from the dock. Ammo lives in the firing cadence
      and the pickup reads from its effect, so neither needs a permanent cell
- [x] Three 60 px cells with 50 px circular slots; dock is 196×64 and sits in the same screen corners
- [x] Marks scaled to 2.6× (skill/heavy) and 4.2 px strokes (dash chevrons), each over a dim wide
      pass so they stay bright and bold at couch distance; cooldown dials unchanged
- [x] Docs: AGENTS D11, README; build stamped 0.1.50
- [x] `npm run build` clean

---

## v0.1.49 — Atomize.exe: six-segment orbit kit (2026-10-30)

- [x] Roster entry 7, white accent, `healthSegments: 6`; `Player.maxHp` now comes from the program def
      on every spawn and respawn, so one hit still removes one segment
- [x] Hull: three overlapping vector ellipse orbits at 60°, each split into two bright half-arcs. The
      inner edge is `0.55r`, so the bright hull stays outside the low-health core mark; the atom core is
      drawn in vector so `⚛` can never resolve to a colour emoji
- [x] Ranged: type 11 electron, alternating hands and inward launch angles, arc-in then slight seek
      (`shotTurn`, `shotSeekRange`, `shotSeekDot`), yellow/green/blue balls with a long white trail
- [x] Skill: three blue orbital shield balls, no timer, 1 damage on contact, one ball blocks one full hit
      before health/campaign damage; a second cast while any survive is refused and refunded
- [x] Power: 2.8 s moving orbit field. Captures projectiles and gauntlet sentries/viruses, holds them out
      of their own AI, spins them faster or slower by weight, lets them damage each other and players,
      and throws everything outward on release. Caster can walk while it runs
- [x] Dock: distinct orbital-shield skill mark, orbit-ring heavy mark, live charge state, cooldown ring,
      and the portrait draws all six segments
- [x] Menu typeface: `--ui` system console stack (Bahnschrift/DIN Alternate/Avenir Next, then platform UI);
      body and menu controls leave `--mono`, while the ASCII logo, boot log and schematic tables stay mono
- [x] Docs: AGENTS D4/D10/D11/D25, README controls, this entry; build stamped 0.1.49
- [x] `npx tsc --noEmit` clean

---

## v0.1.48 — Sweep's power reveals directionally (2026-10-30)

- [x] The giant broom now materializes from the facing side (`cos(facing) < -0.15` reveals right to
      left, otherwise left to right); the direction is latched on the fire frame
- [x] New `SWEEP.powerRevealTime` (0.3 s) beat between the charge and the stroke. It is a physical
      reveal: only the visible part of the lane shoves, with `SWEEP.powerRevealPush` (820), and deals
      **no damage**. The stroke's damage starts only once the whole head is on the lane
- [x] Renderer: the charge shows a faint full-width ghost of the lane, the live reveal draws a bright
      clipped head with a bright front edge, and the sweep is unchanged
- [x] Verified headless: a body 10 units off the lane centre is untouched by the early reveal and takes
      no damage until the stroke starts; a body on the reveal side is pushed immediately; face-left
      pushes the other way. Gauntlet sentry takes 0 damage during the reveal, then dies to the stroke
- [x] `npx tsc --noEmit` clean

---

## v0.1.47 — Gameplay tuning moves to JSON (2026-10-30)

- [x] All tuning records split into `src/game/tuning/player.json`, `programs.json`, `threats.json`,
      `campaign.json` and `world.json`
- [x] `src/game/config.ts` is now a typed facade: it imports the JSON, adds the four derived values
      (`PLAYER.swingHalfAngle`/`guardHalfAngle`, `SWEEP.powerRise`/`powerSpan`) and re-exports every old
      name, so no system changed and no system imports JSON directly
- [x] Structural values stay in code: engine limits, view size, pool sizes, palette, `TRAVEL`, `TRAIL_LEN`
- [x] `src/game/tuning/README.md` documents the file map, units, derived fields and the invariants easiest
      to break while tuning
- [x] Verification: a deep compare of all 40 exports against the previous `config.ts` reports **identical**;
      `npx tsc --noEmit` and `npm run build` clean. No gameplay value changed

---

## v0.1.46 — Title attract demo, UI toggle, bot footwork (2026-10-30)

- [x] Title idle attract demo: after 24 s on the hub, a bot-run gauntlet boots with a random program and
      arena, seeded 72 waves in, canvas UI off; any key/click/wheel/pad edge returns to the hub
- [x] `?attract=1` QA boot hook; `attract` stays out of menus and snapshots
- [x] Demo density: `seedAttractRun` fills sentries, worms, viruses and error blocks to the live caps;
      `fillAttractRoom` re-tops the room every 5 s while `attractMode` is on. Start: 5 sentries, 2 worms,
      10 viruses, 12-14 blocks on CROSSROADS and TRANSIT
- [x] Settings > Feedback **GAME UI** toggle (persisted) and `?ui=0` one-load override; hides the match
      strip, wave banners, readiness docks and minimap but keeps the avatar's own marks
- [x] Readiness dock: five identical 34 px circular slots, bigger ammo dots, dash chevrons, skill and
      heavy marks (scale 1.3/1.32, 1.9-2.2 px strokes), and a circular cooldown mask with a lit sweep
      edge instead of a faint arc. Box stays 182×44
- [x] Bots hold target lock while fighting and orbit a continuous standoff range, so they strafe while
      shooting instead of stepping in and backing out; route is held 0.5 s once cover breaks the straight
      line, and the near-field cover probe is skipped while routing
- [x] Bots raise the 180° guard on incoming bolts outside melee reach (0.42 s hold, 1.2-2.4 s pacing)
- [x] Overcharge beam renders while the heavy charge ring is also up; the gauntlet pilot holds the
      overcharge beam and strafes the line across the target instead of tapping one frame
- [x] Headless: match reversals 18 → 5 in 12 s, gauntlet 2 in 12 s; bot closes on a distant target and
      the round ends normally; guard held 104 frames / guard up 228 frames in a 25 s mirror match
- [x] Browser: `?attract=1` shows 5 sentries, 2 worms, 5+ viruses and 14 error blocks with `showUi` false;
      a keypress returns to the title and tears the world down; `?ui=0` reports `GAME UI: OFF` without
      persisting

---

## v0.1.45 — Angled beam deflection (2026-10-30)

- [x] A guard no longer returns the beam to its caster. The reflected shaft leaves at
      `PLAYER.laserReflectAngle` (0.65 rad = **37.2°**, inside the 30–45° band), toward the side the guard
      was standing on, and reaches `PLAYER.laserReflectRange` (380)
- [x] The deflected line is its own one-pass beam: it can cut a body beside the guard, but the **caster
      and the guard are both skipped**. A body directly behind the guard on the incident line is missed
- [x] The catch still cuts a charged heavy into its full cooldown; the caster no longer takes a hit from
      the catch
- [x] Headless: centred guard → target at +37.2° cut, caster and guard at full hp; body straight behind
      the guard untouched; an offset guard flips the glance to -37.2° and still cuts its angled target

---

## v0.1.44 — Heavy beam: layers, solid stop, guard reflect (2026-10-30)

- [x] `beamReach` in `collision.ts`: pillars, deployed Wedge walls, the compactor plate and a walled
      arena's bounds end the beam; a chasm or open lip does not. Sim damage and the drawn shaft share it
- [x] More shaft layers: wide haze, glow, body, hot white inner band, edge rails, two travelling
      energy pulses, counter-running streaks, muzzle flare and an impact flare on the stopping surface
- [x] Side sparks peel off both edges while firing, with a spray at the solid end (`emitLaserSparks`)
- [x] A raised guard in the beam's corridor reflects it: guard untouched, caster takes 1 damage and the
      shove, a charged heavy is cut into its full cooldown, and the guard flashes a return shaft for
      `PLAYER.laserReflectFlash` (0.34 s). Only the nearest, correctly facing guard catches it
- [x] Headless: pillar reach 231, wall reach 200, plate 280, charged reflect caster 3→2 / guard 3 / beam
      cut / cd 5, guard facing away is cut, overcharge reflection does not touch the guard
- [x] Browser: layered shaft, side sparks, impact flare on a pillar, reflected shaft off a guard; no
      console errors. `npx tsc --noEmit`, `npm run build` clean

---

## v0.1.43 — Sweep broom width (2026-10-30)

- [x] `SWEEP.shotRadius` 15 → **18** (36-unit collision diameter) and the thrown head drawn at
      `half` 20 / `depth` 34, which adds a binder column and a bristle column to the ASCII row
- [x] Headless check: radius 18 at 600 u/s, and a body 30 units off the flight line now takes the
      hit (inside 18 + 13 body radius, outside the old 15 + 13)
- [x] Browser check at in-arena size: the comb reads as `/====\` over 11 bristles, no clipping or
      broken rows; the dust puff still trails the wider head

---

## v0.1.42 — Sweep broom speed (2026-10-30)

- [x] `SWEEP.shotSpeed` 500 → **600**, `shotTtl` 0.9 → **0.85**: max range 450 → **500**, so the broom
      contests a traded shot without turning into a fast projectile
- [x] Headless check: 600 u/s, 0.83 s fuse, 500 max range, 15 radius, 2 damage; still dies on cover

---

## v0.1.41 — BUFFER_OVERFLOW.EXE (2026-10-30)

- [x] Program id 6, hot-pink accent, `⧗` metadata glyph and a vector hourglass core (no emoji tile,
      no dark core disc) with rounded, overlapping triangles
- [x] Six clock-face health segments, two per health segment, orbiting the body with live hands
- [x] Ranged hourglass: slow, wide, no tail, dies on geometry, passes through three bodies and flips
      its spin on every hit
- [x] Skill **FAST-FORWARD**: 2.5x movement, attack rate and cooldowns for 2.6 s (`fastT`/`pdt`)
- [x] Power **TIME DILATION**: every other body, hostile shot and the gauntlet simulation at 0.3x for 5 s,
      with a pink hourglass burst and an edge wash
- [x] Bot taps fast-forward at close range; generic heavy hold builds the dilation
- [x] Headless checks: 3-body chain, spin flips, 2.5x walk/cooldown, 0.3x other bodies and hostile shots

---

## v0.1.40 — Power-attack charge cut 30% (2026-10-30)

- [x] Probe beam 0.9 → **0.63 s**, Wedge plow 0.8 → **0.56 s**, Sweep broom 0.85 → **0.6 s**,
      Toxic jet 0.8 → **0.56 s**, Kaboom carpet 0.85 → **0.6 s**. Fisher's net has no charge; it is drawn
      by moving and released by the player, so it is unchanged
- [x] Tap window (`heavyTapMax` 0.16 s) is untouched, so a quick tap still casts the skill

---

## v0.1.39 — RECYCLING BIN compactor, destructive plates, campaign score (2026-10-30)

### RECYCLING BIN (id 7)
- [x] Trapezoid floor (`ArenaDef.slant`): narrow at the top, full width at the bottom; the flanks are
      the same drop as the lip, drawn as void wedges with dashed diagonal edges
- [x] Big bottom hole (695,786 → 1295,1046) with left and right ledges as the only survival ground
- [x] Compaction arm: 30 s cycle, 2.6 s warning, a 98 u/s stroke that **stops on the hole's leading edge**
      (`stop: 786`), then a slow 5 s climb. The plate is 130 thick and narrows with the trapezoid, so it
      reads as a moving wall. Bodies are glued to its face (`ky = 0`) and pinned on the bottom ledges
- [x] No solid cover in the arena; only breakable file boxes, so the arm never pins a body on a pillar
- [x] File boxes drop back in during the quiet window (`FILE_PROP.dropEvery`), with a drop-in fall

### File boxes (light debris)
- [x] Boxes are movable debris: rounded, dashed outlines, no collision with bodies, and no overlap
      (pairwise separation). A body shoves them, a lash launches them without deleting them (2 hp),
      a guard bats them, shots and blasts shove them
- [x] Easy-in/easy-out motion: a target velocity with a 6000 u/s² ramp and low drag, so a shove
      accelerates and then glides instead of snapping to speed

### Fall grace
- [x] `fallT` grace (0.6 s) instead of an instant death at the lip, slant or hole edge: the body hangs,
      stays steerable at 62% speed against a 74 u/s outward pull, and is saved if it gets back on the floor

### Destructible plates + cracks
- [x] Wedge's wall has structural health (`WEDGE.wallHp` 7). Shots chip 1, spears/brooms/bombs chip 2,
      lashes chip 1, and blasts chip 2. At zero it breaks with `EV.WALL_BREAK` and a de-rez burst
- [x] Three-stage crack read on the plate plus a hit shake; file boxes use the same crack helper
- [x] Wedge's wall blocks every shot type (the lobbed shell is the one airborne exception), so it cannot
      be shot through, and it still reflects
- [ ] Destructible arena cover (pillars) is **not** built. A data record for destructible geometry
      should land before any map assumes it

### Campaign score
- [x] Data crates authored in `campaign.ts`, spawned on the breach so the drill cannot break them
- [x] `World.dataTotal` / `dataKept` / `campaignDamage` feed an end-of-level score: kills, data preserved,
      time against par, damage taken, plus a 1500 clean-sweep bonus. Score, best and clean sweeps persist
      in the save slot
- [x] Result overlay held for 1.1 s after a death so the aftermath is visible before the buttons appear

### Verification
- [x] `tsc --noEmit` clean
- [x] Headless arm checks: mid-arena body carried into the hole and dies at the rim; side bodies pinned and
      alive; arm speed 98 u/s; no pillars
- [x] Headless fall-grace checks: lip death at 0.6 s with no input, saved when steering back; hole death
      at 0.6 s, saved when steering out
- [x] Headless wall checks: 7 shots, hp 7 → 0, breaks on the seventh and blocks every one
- [x] Headless campaign checks: 6 crates spawn on the breach, no pillar overlap, one broken leaves 5/6

---

## v0.1.38 — Open-wall arenas, THE LEDGE (2026-10-30)

### Arena edges
- [x] `ArenaDef.walls: 'solid' | 'open'` (default solid). Data, not a mode: host sim, guest prediction,
      bots, renderer, minimap and picker preview all read the same flag (AGENTS D19)
- [x] Open arena: `stepPlayerMotion` skips the boundary clamp, and a body whose centre crosses the lip
      falls through the ordinary death path as `SRC.VOID` — loses the round, respawns in training/gauntlet,
      fails a campaign node. Dash/iframe frames are cleared first; a pad or lift ride still owns the body
- [x] Shoves are lethal at the lip: Sweep's broom, Wedge's bash/plow, bombs and the melee lash carry bodies
      out. Worm/virus/sentry bounds clamps are skipped on open arenas and a threat past the lip is killed
      through its normal damage path, so it credits the gauntlet/campaign clear and drops its pickup
- [x] Shots die at the lip instead of ricocheting; committed shapes keep their geometry death, so a bomb
      still detonates on the edge. Bots refuse a dash that would end past the lip and steer back over a
      130-unit band
- [x] Presentation: dashed lip over a black void band that swallows the floor grid, inward chevrons, dashed
      minimap rim and preview border, and the camera may show `CAMERA.voidMargin` (90) past the lip
- [x] `THE LEDGE` (id 6): violet, ring signature, six pillars, inset eight-point spawn ring

### Verification
- [x] Headless probe (18 checks): shove kill + `SRC.VOID` + round loss, iframes do not save a fall, solid
      arena still clamps, walking off falls, training respawn, bolt dies at the lip vs bounces on a wall,
      virus cull credits a clear, bots play 60 s without walking off, Sweep's thrown broom carries a body
      over the line
- [x] Browser on THE LEDGE: lip, chevrons, void band, dashed minimap and picker all render; gauntlet
      autopilot ran to wave 4 with 6 kills and no threat outside bounds; no console errors
- [x] `npx tsc --noEmit` and `npm run build` clean
- [ ] Playtest: is the 130-unit bot edge band too cautious on a big open map? Does the shove-to-kill rate
      feel like a strategy or a coin flip?
- [ ] Consider a second open arena with a narrower lip or an interior island; do not convert an existing
      arena without checking its spawn ring and bot pathing
- [ ] Void deaths have no bespoke sound yet; they reuse the hit chirp plus the death burst

---

## v0.1.37 — Fit-first split camera, shared HUD, rigs, layout slow motion (2026-10-30)

### Camera
- [x] Local players stay on one screen while the whole group fits at `CAMERA.sharedZoomMin` (0.68) with
      `CAMERA.groupPad` (60). The camera anchors the group's bounding-box centre and may pull past combat
      zoom to fit; with `CAMERA_ZOOM` 1.28 the single-view fit is about 1350x707 world units
- [x] Minimal panes: farthest-pair clustering peels only the players who do not fit. Four with one far
      become two panes, a tight trio shares a pane, two pairs become two panes, four far use the 2x2 grid.
      `CAMERA.shareSlack` (70) is the merge hysteresis; dead locals are spectators and do not force a split
- [x] Split pane frames: a 1.6px outline in the primary local's color over a dark underlay, plus a faint
      inner line, so two similar floors read as two windows
- [x] HUD: one readiness dock per local at screen corners; one shared minimap, lower-left for a solo view
      and top-centre when the view is split or more than one local is active
- [x] Layout slow motion: a view-count or group-mask change dips the local sim to 0.35x and holds it for
      a full 1 s, then eases back over 0.3 s. Network play and the stress bench never slow
- [x] Camera rig director (`src/game/camera.ts`): four pooled rigs, priority/blend/hold, and
      `Renderer.playCameraRig`. Cues: gauntlet wave glance at an off-screen sentry pack and a campaign
      breach push-in
- [x] QA: `?gauntlet=1&arena=N&bot=1` runs a gauntlet with `BotBrain.engageHostiles` driving the local
      player; `?debug=1` exposes a read-only inspection handle for scripted split/group tests

### Verification
- [x] Browser 1280x800 on TRANSIT: four clustered at one view (zoom 1.143, view 1120), three close + one
      far at two panes (masks 7/8), two pairs at two panes (masks 3/12), four far at 2x2. Pane frames,
      four corner docks and the top-centre map checked in each layout
- [x] Slow motion: the round timer dropped 0.68 s over 1.20 s wall during a 2→1 merge, then 1.00 s over
      1.01 s once the one-second dip expired; normal speed returns
- [x] Rig: a priority-5 rig at (2200,1000), zoom 0.7 reached blend 1 and pinned the view to the arena's
      right/bottom bounds; clearing it returned the default framing
- [x] `npx tsc --noEmit` and `npm run build` clean; `npm run bench` unchanged (gauntlet max 0.165 ms avg
      / 0.627 ms p99; eight-bot swarm 0.071 / 0.217)
- [ ] Playtest the fit threshold and shared min zoom in production; tune `sharedZoomMin`, `groupPad`,
      `shareSlack`, and the `layoutSlowHold`/`layoutSlowScale` pair
- [ ] Local input slots and the same-screen menu flow for 2–4 humans; split is still camera plumbing
- [ ] Per-pane campaign/wave banners; the score strip is one shared strip
- [ ] A team field so surviving bot allies can be followed outside the campaign drill

---

## v0.1.36 — Split cameras, death spectate, Kaboom clearance (2026-10-30)

### Camera
- [x] Dynamic zoom with `CAMERA.zoomMin` (0.88) and `zoomMax` (1.03) as multipliers of the base. A tight
      group sits at the max; a group spread across `CAMERA.focusRange` pulls to the min. Separate
      `CAMERA.zoomFollow` easing
- [x] Split-screen plumbing: up to four panes, one full screen, two side by side, three or four in a 2x2
      grid. Each local slot gets its own camera, zoom, lock reticle, readiness dock, minimap and lift
      overlay. `?split=N` is a QA-only visual hook
- [x] Death spectate: while a local slot is dead its camera follows a surviving campaign drill partner,
      then the body that struck the killing blow, then the nearest living player. Respawn and pad swaps
      snap instead of panning across the arena
- [x] Killer attribution: every `damagePlayer` records `killerKind`/`killerId`; hostile bolts carry the
      sentry index (or the drone), and worm, cascading-error and firewall contact pass their pool index

### Kaboom
- [x] Hull fins moved outward and shortened: base `0.46r` → `0.72r`, half-base `0.95` → `0.56` rad. Center
      mark `coreScale` `0.98` → `0.86`
- [x] Hull clearance rule recorded in AGENTS D4: a health segment's inner radius stays outside the 0.6r
      core disc, at full and one-segment health

### Verification
- [x] Headless: fins clear the core disc by 1.33 units at full and one-segment health; Kaboom draws no
      frame; a hostile bolt attributes to its sentry; a worm blow attributes to its worm
- [x] Browser at 1280×800: 2-pane and 4-pane layouts with per-pane docks and minimaps and independent
      cameras; a training drone kill moved the camera 48 → 936 while tracking the drone; respawn snapped
      back to 48; drill ally priority vs assault killer priority checked directly
- [ ] Playtest the min/max zoom in production and tune `CAMERA.zoomMin` / `zoomMax`

### Next
- [ ] Local input slots and the same-screen menu flow for 2–4 humans. The renderer is ready; input/sim
      slot ownership, device assignment and the LOCAL menu are not
- [ ] Per-pane campaign/wave banners in split; the score strip is currently one shared strip
- [ ] A real team field so surviving bot allies can be followed outside the campaign drill
- [ ] Decide whether a firewall death should follow the beam; today it falls back to the nearest player

---

## v0.1.35 — Drill squad in reach, framed camera (2026-10-30)

### Campaign
- [x] The drill squad forms an arc `CAMPAIGN.drillRing` (250) in front of the player, spread by
      `drillSpread` (0.72 rad), instead of taking the arena spawn ring. Knockdowns respawn on that arc;
      the player keeps the gauntlet spawn so a drill death lands back in the spar
- [x] Placement tries outward rings, then tighter ones, then the nearest clear arena spawn, so a small
      island or a corner spawn never drops a body in cover or on top of the player

### Camera
- [x] Follow camera leans toward nearby live bodies: other players, the training drone, worms, viruses,
      sentries and cascading-error blocks. Distance-weighted mean offset inside `CAMERA.focusRange`, capped
      at `CAMERA.maxBias`. Opposing bodies cancel out; a body across the arena is ignored
- [x] The local anchor is clamped to the middle band of the view (`CAMERA.edgeMargin`) so the pull cannot
      walk the player off-screen. Arena bounds still win at a wall. Follow rate slowed from 9 to 6.2
- [x] All numbers in a `CAMERA` block in `config.ts`; no dynamic zoom (screen-wide kit numbers assume
      `CAMERA_ZOOM`)

### Verification
- [x] Headless: 1–3 drill bots land 250 units from the player and clear of cover on all six arenas;
      timeline drill 18.0 s → breach 21.4 s → 10 kills clears; an idle player fails at 36 s
- [x] Browser: drill with both bots in the fight, SPARRING DRILL and BREACH WAVE banners, camera measured
      leaning toward a staged sentry 350 units out (player at 0.39 of the view, sentry at 0.90)
- [x] `npx tsc --noEmit` and `npm run build` clean; `npm run bench` unchanged

### Next
- [ ] Playtest the pull in 1v1, 1v3 and gauntlet; tune `CAMERA.focusRange` and `CAMERA.maxBias`
- [x] Dynamic zoom landed in v0.1.36. `SWEEP.powerSpan` and the sentry pack window stay in world units;
      their screen coverage is approximate as the camera zooms, which is accepted (the heavy is still a
      wide sweep, just not a literal screen width at every zoom)

---

## v0.1.34 — First campaign node: BUILD ROOT (2026-10-30)

### Node
- [x] `src/game/campaign.ts` owns the first playable node: BUILD ROOT, sector 0 (LOCALHOST), QUARANTINE
- [x] Campaign script in `World` on the gauntlet simulation: 18 s sparring drill, 3.4 s `SYSTEM BREACH`,
      then the threat assault. `World` mode stays `gauntlet` with `campaign = true`
- [x] Drill squad uses the run's 0–3 bots through the normal `BotBrain`; `NO BOTS` still fields one
      instructor. Both sides respawn on the training timer during the drill
- [x] Breach de-rezzes the squad, clears live projectiles, heals the local player and starts a quiet
      warning window. No threats exist before it
- [x] Assault opens with a sentry pack, adds worms, then a fresh pack every 14 s. Waves start at 3 and
      step every 14 s, so viruses arrive late. Delete 10 threats to clear; one death fails the node
- [x] Short banners for SPARRING DRILL, SYSTEM BREACH and NODE CLEARED / SIGNAL LOST, plus a bottom strip
      with one pip per threat delete. Wave banners read BREACH WAVE in campaign
- [x] Clear writes the save slot (program, players, bots, seconds), shows the node-cleared overlay, and
      CONTINUE returns to the save-slot stage. Failed runs offer RETRY and SLOTS; nothing saves mid-level
- [x] Filled slots now resume instead of reporting "not wired"; the player select begins a new run

### Verification
- [x] Headless probe: drill keeps three bodies active and zero threats; the breach leaves only slot 0
      alive and healed; the assault queues two sentries at wave 3 and reaches 2 sentries + 1 worm by 20 s;
      forcing 10 kills clears and freezes the node; an idle player fails in the assault
- [x] Browser 1920×1080: new-run flow slot → bots → player select, drill with two bots, SYSTEM BREACH
      banner with the squad gone, assault with sentries and a worm, 4/10 fail overlay, forced-clear
      overlay, saved slot readout, and resume restoring Kaboom plus two drill bots
- [x] `npx tsc --noEmit` and `npm run build` clean; `npm run bench` unchanged

### Next
- [ ] Add the next node to `campaign.ts` and a between-level route beat; a cleared slot replays node 1 today
- [ ] Team rules so campaign bots can fight beside the player after the breach instead of being drill-only
- [ ] Playtest `CAMPAIGN.drillTime`, `killsToClear` and `sentryInterval` together; the first clear currently
      takes about a minute of assault
- [ ] Decide whether `NO BOTS` should keep the mandated instructor or receive a solo drill target

---

## v0.1.33 — Kaboom hull points outward (2026-10-30)

### Identity
- [x] Kaboom's hull is three outward-pointing triangles spaced 120° apart instead of four inward ones on a
      square. Each triangle is one health segment and the three together read as a larger triangle around
      the bomb
- [x] The bases sit behind the core disc, so only the points clear the bomb core at avatar size
- [x] No frame-only piece and no rim: three segments are the whole hull, so `pathProgramFrame` draws
      nothing for Kaboom
- [x] Checked in the select portrait at full health, and in-arena at full, two, one and zero segments

### Verification
- [x] Browser 1920×1080: the Kaboom card reads as a triangle of triangles; the in-arena hull keeps the
      bomb clear of every bright edge; no console errors
- [x] `npx tsc --noEmit` and `npm run build` clean
- [x] `npm run bench` unchanged (sim and bot budgets unaffected by a hull path)

### Next
- [ ] Playtest whether the three-fin hull still reads as damage at one segment while the hull spins

---

## v0.1.32 — KABOOM.EXE and the carpet spray (2026-10-30)

### Identity
- [x] `KABOOM.EXE` is in `PROGRAMS` (id 5, role `BOMBER`) with `PROGRAM_COLORS.kaboom` `#ff5a3d`
- [x] Hull was a square made of four inward triangles: three health segments and one frame-only triangle,
      with `coreScale 0.98`; checked at full and one-segment health (changed to three outward triangles in
      v0.1.33)
- [x] Core and shells use the Wingdings bomb when the family is installed, otherwise `drawBombMark` draws
      a vector shell so the mark never reads as a letter
- [x] `hasSymbolFont` no longer trusts `document.fonts.check` alone: a missing system family reports true
      in Chrome, so glyph advances are compared with a definitely-missing family

### Kit
- [x] Ranged: one slow shell (type 8, 250 u/s), no direct damage, 52-radius blast for 1 damage and a 520
      shove; it detonates on a body, on cover, or at the end of its fuse
- [x] Skill: a heavy lobbed shell (type 9, 0.62 s arc, 300 range) that flies over pillars, lands, and
      detonates for 2 damage in a 116-radius blast
- [x] Power: five lobbed shells in a shallow fan, released left to right every 0.07 s, each with its own
      66-radius blast; the row lands about 150 units wide
- [x] Bombs are never deflectable: the guard, swing, shield wave, Wedge plow/bash and Fisher net all skip
      types 8/9 instead of converting them to bolts
- [x] Shared area damage: `explodeMine` now calls `explodeBlast`, so mines and bombs use one cover-aware
      damage path for players, the drone and every gauntlet threat family
- [x] Readiness dock: single-shot ammo, a fused bomb for the skill, a three-shell row for the carpet, and
      the carpet cooldown
- [x] Kaboom bots lob when the target sits between 90 and `lobRange + 60`; the generic heavy hold builds
      the carpet

### Verification
- [x] Headless probe: ranged shell spawns type 8 with a 52 blast and 250 speed and clears on detonation; a
      body at 200 and another at +60 both lose health, the near body slides 53 units, and the caster is
      never caught by their own blast
- [x] Headless probe: the lob spawns type 9 with `arcDur` 0.62 and a 116 blast, lands on its beat and takes
      the target from 3 to 1 health
- [x] Headless probe: the power spawns five shells, starts its 8 s cooldown, catches all three standing
      bodies in the row, and leaves the caster untouched; a shell that reaches cover dies there and the
      body behind the pillar takes no damage
- [x] `?autoplay=3`: slot 0 ran KABOOM.EXE and the log caught all five type-9 shells alive together,
      spread 40+ units apart from the stagger, with no console errors
- [x] Browser 1920×1080: the program card, arena hull and a shell in flight render; the vector bomb mark
      reads on a host without Wingdings
- [x] `npx tsc --noEmit`, `npm run build` and `npm run bench` clean

### Next
- [ ] Playtest the carpet's 0.07 s stagger and 150-unit width; tune `clusterStagger`, `clusterSpread` and
      `clusterBlast` together rather than adding damage
- [ ] Decide whether Kaboom's shells should be visible online; that needs a snapshot/protocol change like
      every other kit
- [ ] A host with Wingdings installed should be checked so the `M` bomb path is exercised, not just the
      vector fallback
- [ ] Give destructible cover a bomb reaction once arena hazards are in scope

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

## v0.1.30 — TOXIC.EXE, aimable jet and player-hull bots (2026-10-29)

### TOXIC.EXE
- [x] `TOXIC.EXE` is in `PROGRAMS` (id 4, role `VENOM`) with the green accent and a `☠` core
- [x] Identity: six-point star hull (twelve equal edges, three clean segments), `coreScale 1.0`; the
      portrait and the arena share the shape and mark
- [x] Ranged: `†` needle (type 7) with venom on hit; no bounce, no motion tail
- [x] Venom: 3.5 s, 0.34 per 0.75 s, refreshed by a new hit; poisoned bodies flash `☠` and a green rim
- [x] Skill: 360° burst that damages and poisons through a clear line of sight, drawn as a steady spray of
      neon circles (particle kind 5) for the whole `sprayLife`
- [x] Power: rooted, aimable venom jet; 0.8 s charge, 1.25 s stream, 0.2 s damage ticks, cover cuts both
      the shaft and the damage
- [x] Bots: dedicated spray tap at close range; the generic heavy hold builds the jet

### Identity and bots
- [x] A program's colour, hull and glyph no longer change with mode: local modes always use program
      identity, and only networked guests fall back to the slot palette
- [x] Local bots draw the same three-segment program hull, glow and damage read as the local avatar, with
      no heading arrow, energy arc or readiness column
- [x] Score pips use program colours in local matches; the minimap drone ring uses the threat ice colour
- [x] Menu cards show one outline: the focused item owns the border, and a saved program or arena keeps a
      dot after its name (also removed the bright selected border on sector tabs)

### Verification
- [x] Headless probe: needle type 7 applies venom, spray hits and poisons in radius, the jet fires after
      charge, roots movement (0 units), aims at 2.4 rad/s, ticks damage, and does nothing through cover
- [x] Browser: program select shows all five cards; training and VS BOTS both draw the green star and
      `☠`; a one-health Probe bot shows one lit arc and two ghosts with the local glow
- [x] Browser: jet renders narrow with a bright spine, stops at the cover edge; spray circles spread
      across the cloud for the duration
- [x] `npx tsc --noEmit`, `npm run build`, `npm run bench`

### Next
- [ ] Decide whether gauntlet threats should carry the venom state (they take the damage, not the poison)
- [ ] Playtest jet turn rate and duration; tune `streamTurnRate`, `streamTime` and the tick damage together
- [ ] Give Toxic a charge tell of its own; the jet currently has no wind-up mark in the arena

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
- [x] Mobile/touch fallback investigation (PWA audience): first pass built as v0.1.57 (D28). Physical
      phone QA and thumb tuning remain before calling it a mobile release

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

- [ ] **BOSS RUSH** (post-campaign): a separate mode that chains the finished sector bosses back-to-back,
      reusing their campaign definitions and arenas. Gate it on the full campaign route, then add local
      clear-time records.
- [ ] Unlockable characters: **THE WARDEN** and **SCRIPT_KITTY** as campaign-earned playable programs,
      each with a full identity (hue, hull, glyph, portrait) and kit rather than an NPC skin. Keep unlock
      state local-only; online still runs Probe until character kits travel in `Snapshot`.
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
- Controller rumble is verified against a synthetic standard actuator and a legacy `pulse` shim, not
  physical pads.
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
- Toxic's venom applies to players, local bots and the training drone. Gauntlet worms, viruses, sentries
  and error blocks take spray/jet damage but cannot be poisoned yet.
- Local multiplayer is a multiplayer-menu placeholder. No local slot, second input device, shared camera
  or local match exists yet; the only local multi-body paths today are bots and the gauntlet thrall.
- Story mode lists three local save slots, but nothing writes or reads a run: the first playable sector
  and the new-game/resume wiring do not exist. The slot format is already versioned in `saves.ts`.
- ROCKET NAVIGATION's growing barrier, CAR NAVIGATION's moving route trail, AIRPORT's time-tile hazard, SPACE INVADERS' cannon shots, FAX MACHINE's moving print head, SMART PLUG's circuit ring, SMOKE DETECTOR's alarm rings, SMART WATCH's second hand and BUSINESS LAPTOP's moving cards/preview cover are not in the bot nav grid or any snapshot. Bots can path through them, stand on a warning tile, eat a cannon shot, stand in the print bar, cross a live arc, step on a smoke sensor, walk through the hand or be pushed by a mail card; those maps are deliberately excluded from hosted rooms. PONG's rally ball is local-only and not part of bot pathing; its court has no static cover. WEAPON SYSTEMS' console banks and SPEAK & FIND's picture cards are static cover/presentation only; no jet weapon, eject action, thruster system or pickable card target exists.
- Compress is local-only like every program kit: a guest does not see a shrunk body and online still runs
  Probe. A compressed player's cover and arena-bound collision still use `PLAYER.radius` even though the
  drawn hull and projectile/bomb hitboxes shrink. A shrunk worm's contact and bite reach stay at the
  `WORM` constants. The burst's player cap uses rounding, so 3 segments become 2, not 1.5.

## MEMORY FRAGMENTS

- [x] Shards persist until collected, wiped or saved; campaign save points store stacks and shards

## STORM CLOUD (mini-boss)

- [x] `MINIBOSS.STORM_CLOUD = 4`, `storm-cloud` registry body, wave-28 schedule entry
- [x] Ceiling-band hover, slow tracking and slide-out so the cloud cannot be stood on
- [x] Alternating rain rows as shootable hostile projectiles (type 18)
- [x] Telegraphed bolt (type 19) with a 18-damage return on guard/lash
- [x] Bot rain-lane avoidance in `avoidFurniture`; digital 3/9 deaths, rookie 6/9
- [x] `?storm=1` QA hook, `.tmp/storm-check.ts` and `.tmp/storm-balance.ts`
- [x] Storm Cloud body rebuilt as 84 opaque, individually rotated squares in three overlapping layers, so
      the mass reads as a rough cloud and the stack count is hidden (v0.1.145).
- [ ] Human playtest pass: confirm the lane is readable at couch distance and the bolt tell is long enough

## BOSS BOUNDS

- [x] `bossEdgePad`: mini-boss bodies may overhang the arena edge by half their radius, applied to all five

- [x] Starfish at 1.5x (core 75, arm 69, reach 435) with mouth/chomp and spines scaled to match; its center
      and arms cross cover like the Mega Worm (v0.1.145).
- [x] Starfish and File Blob interiors are opaque and brighter, so neither reads as a ghost over the floor
      pattern (v0.1.145).
- [ ] Check both bosses on the brightest arena patterns to confirm the new fills still separate from the
      floor at a glance.
- [x] Storm Cloud no longer clamps to the arena bounds, and rain/lightning stop on cover while return fire
      at the cloud stops on the same block (v0.1.145).
- [ ] Watch a Storm Cloud fight on a cover-heavy arena to confirm the block-shelter rule reads as intended
      and the cloud does not park off the lip for long.
- [x] Idle Hands' slam holds the palm flat and damageable for a full second before the rise-out, so the
      slam is a real punish window (v0.1.145).
- [ ] Play a trio fight and confirm the one-second palm hold reads as an opening rather than a stuck hand.
- [x] BOSS RUSH: registry-ordered mini-boss ladder with no fodder, solo and local co-op, plus `?bossrush=1`
      (v0.1.145).
- [ ] Decide whether online rooms should get boss rush; it needs mini-boss bodies in `Snapshot`, which is a
      protocol decision rather than a menu toggle.
- [x] Starfish girth pass: thicker core and arms, same reach (`radius` 96, `armRadius` 92, `armWidth` 0.84)
      (v0.1.145).
- [ ] Look at the fatter Starfish in a fight and confirm the 92-radius arms do not crowd each other at the
      hub or read as one merged shape.
- [x] Idle Hands runs two palms instead of three for solo balancing (`hands` 2); the count is tuning, so the
      ring, separation, redirect and kill credit followed without code changes (v0.1.146).
- [ ] Play a solo pair fight and decide whether two palms still make the hand-on-hand redirect worth setting
      up, or whether the pair needs a shorter slam/charge cadence.
- [x] Storm Cloud entrance: one square appears, then the body gathers into the full cloud (v0.1.147).
- [ ] Watch the storm entrance at full size and confirm the gathering squares do not read as a loading or
      glitch effect, then tune `introTime` or the per-square spread if they do.
- [x] Idle Hands stop strobing: the palm and eye are drawn opaque instead of multiplying the render
      interpolation factor into their fill (v0.1.148).
- [ ] Audit the other hand-drawn boss fills for `* alpha` on body geometry, so the same interpolation leak
      cannot come back in a new silhouette.
- [ ] Watch the scaled Starfish on a cover-heavy arena: arms should sweep over pillars, and the staging pad
      should not pin it to the middle of small arenas.

- [x] TEST RANGE sandbox arena (`?range=1`, hidden from pickers) for geometry-free boss reads.
- [x] Mega Worm 3x silhouette, doubled health, curled arrival pose (v0.1.143).
- [x] Mega Worm entrance is a full offscreen lap ending in a MIDI bird cry with a screen shake; the flyover
      pass is held for the cry, and a slow tail sweep is back as the one committed ground attack (v0.1.145).
- [ ] Watch a full Mega Worm fight and judge the tail sweep: it should punish loitering behind the chain
      without out-shoving the pass.
- [ ] Watch the 3x Mega Worm in a normal gauntlet arena; it may want a dedicated boss room rather than
      the shared threat pool.

- [x] Attract and `?demo=1` alternate boss showcase sessions through the mini-boss registry (v0.1.144).
- [ ] Watch a full kiosk cycle to confirm the boss session reads before the next run starts, especially the
      3x Mega Worm on the smallest eligible arena.

- [ ] Review all five demo bosses with `?boss=1` and record tuning/presentation notes (v0.1.145).

- [x] Boss camera framing and floating Mega Worm (v0.1.145).
- [ ] Watch a full boss demo cycle after the camera/worm fixes and note any remaining framing or snag
      issues per boss.

- [ ] Review every boss on TEST RANGE via `?boss=1`, then re-check the same bosses on the regular arena
      pool and tune framing/movement for cover-heavy maps (v0.1.145).

- [x] ROCKET NAVIGATION trajectory is a shot-only dotted reflector; bodies and dashes cross (v0.1.145).
- [ ] Play a ROCKET NAVIGATION match long enough to judge the reflected-fire buildup and whether the line
      needs a bounce cap or a brighter hit flash.

- [x] Mega Worm reworked as a flying boss with committed flyby passes and no arena clamp (v0.1.145).
- [ ] Watch a full Mega Worm fight on TEST RANGE and tune pass speed, orbit radius, snap range and camera
      margin from play.
