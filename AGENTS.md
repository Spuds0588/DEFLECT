# AGENTS.md — DEFLECT operating contract

Read this first. It is the binding working agreement for anyone (human or agent) changing this repo.
`PRD-Deflect_game.md` holds the original design spec; this file records **how we build it** and where we
intentionally diverge from that spec.

---

## 1. Documentation workflow (do not skip)

These files keep us from re-litigating decisions or rebuilding old work:

| File | Role | Rule |
| --- | --- | --- |
| `AGENTS.md` | Living architecture + decisions | Update when an invariant, system, or decision changes. |
| `TODO.md` | Forward plan | Mark tasks as they land. Never delete a completed item without a HISTORY entry explaining it. |
| `HISTORY.md` | Append-only session log | Add an entry at the end of every work session: date, goal, changes, verification, next. Newest at the bottom. |
| `README.md` | Architecture, stack, performance, netcode | Keep it to how the game is built and run. Player-facing detail belongs in `GAME_GUIDE.md`. |
| `GAME_GUIDE.md` | Player-facing rules, modes, controls, QA pass | Move gameplay specifics here; do not grow the README with kit or threat numbers. |

Before starting: read `HISTORY.md` (last entry) and `TODO.md`. Do not start a phase that a newer
HISTORY entry says was deliberately deferred without calling that out.

### Shipping a finished feature (decided 2026-11-02)

The repo ships from `main`: `.github/workflows/pages.yml` builds and publishes
<https://spuds0588.github.io/DEFLECT/> on every push. A finished feature is therefore not finished while it
is only local. Once a feature, arena or program passes its checks, commit and push it without asking for a
separate confirmation:

1. Its headless probe (`.tmp/*-check.ts`) passes, or the equivalent verification is written down.
2. `npm run build` passes (`tsc --noEmit` + Vite).
3. `npm run bench` is clean when the change touched `World`, bots, collision, networking or threat pools.
4. README, GAME_GUIDE, AGENTS, TODO and HISTORY are updated in the same commit, and the version stamps
   (`package.json`, `package-lock.json`, `index.html`, `src/main.ts` `BUILD`, `public/sw.js`) are bumped.
5. The commit is pushed to `origin main`, then the Pages run is confirmed successful and the published page
   is checked for the new version string.

Do not push when a check is red, when the change is half-finished or deliberately deferred, or when it only
exists behind a QA hook no player can reach. Report a red check instead of committing around it. Never fix a
bad deploy by unpublishing; fix forward.

### Dev environment cleanup (required)

This is a limited-memory development environment. A finished task must leave it idle:

- Stop every process you started for the task: `npm run dev`, Vite, preview servers, watchers, `tsx`
  harnesses, and background shells. Stop the PID or process tree you recorded; never use broad
  `pkill -f` or `killall`, which can match and kill the agent's own process.
- Close browser or preview tabs you opened for the task after capturing the evidence. Do not close the
  user's tabs.
- Remove scratch files and generated caches created only for the task. Keep tracked files and the
  reusable `.tmp` QA probes; do not blanket-delete `.tmp`.
- Remove build output you generated unless it is the task's deliverable or needed for the handoff.
- Check the running-process list before the final response, not only processes started in this task.
  Stop any Vite, preview or test-harness process owned by this chat that was left by earlier work, and
  confirm no task-owned listener remains. Do not leave a dev server running "for next time"; start it
  again when the next task needs it.

---

## 2. Decisions already made

### D1 — No game engine (decided 2026-10-28)
Vanilla TypeScript + Canvas 2D + Web Audio, built with Vite, deployed as a PWA. A first version needs a
fixed 1280×720 simulation, a small renderer, and direct control over allocation and draw calls. Engines
(Phaser, PixiJS, Godot web export) add bundle weight, an asset pipeline, and a scene model we do not need
for pure vector shapes; they also complicate the "Tauri shell later" path. The PRD already mandates pure
Canvas 2D with no `shadowBlur`.

Revisit only if we need tilemaps, complex skeletal animation, or a level editor that would cost more to
hand-roll than to adopt.

### D2 — One stick: movement == facing (decided 2026-10-28)
The PRD says "twin-stick"; the game direction explicitly overrides it. There is **no aim input**. Facing
comes from the movement vector:

- Keyboard: 8 directions. Standing still keeps your last facing.
- Gamepad: analog stick direction, deadzone **0.2**. Partial tilt moves slower but still sets facing.
- Mouse: buttons only. The mouse never sets facing. "WASD + mouse" play means mouse buttons are actions.
- Touch: the on-screen stick writes the same movement vector, deadzone and facing rule as a keyboard or
  pad. The action buttons write ordinary action bits; there is no second stick and no touch-only aim.

Consequences that are part of the design, not bugs:

- Swinging **locks facing** for the whole swing. You cannot sweep the racket.
- Swinging slows movement to 55%. A whiff then adds lag; a hit recovers faster.
- You must face a threat by moving toward it, which puts you in danger.
- Dash direction is the **last nonzero movement direction**, not facing. Target lock can hold facing on
  an enemy while you strafe; dashing then goes sideways, not at the target.
- Target lock (`LT` hold, `Q` toggle) holds facing only. It never grants a second aim stick, and the
  beam still sweeps at `PLAYER.laserTurnRate`. `RB` and right-stick left/right step the lock around the
  available targets while it is active; that is target selection, not aim.

### D3 — N players, host-authoritative star (decided 2026-10-28)
Not a two-player game. Target cap is **8** for v1 (`MAX_PLAYERS` in `src/game/config.ts`), measured rather
than assumed (see §8). Topology:

```
        host (slot 0): authoritative sim @60Hz
        /      |       \
   guest 1  guest 2  guest N     each sends inputs, receives snapshots
```

Every guest connects to the host only. No mesh. The host runs all physics, hit detection, scoring, and
round flow. Guests send input packets at 60 Hz; the host broadcasts snapshots at 30 Hz; guests interpolate
other entities and locally predict only their own player's movement for feel. A guest never resolves hits.

The 8-player cap is a product decision for v1, not a protocol limit. Bandwidth is the real ceiling
(30 Hz snapshot × (N−1) guests). v0.1.2 measurement (includes directional event fields): 8P with 48 live
projectiles is a 2.88 KB snapshot, 86.5 KiB/s per guest and ~0.59 MiB/s total host upload with 7 guests;
the 96-projectile worst case is 5.23 KB, 156.8 KiB/s per guest and ~1.07 MiB/s host upload. Sim cost is
0.01–0.06 ms per tick in the measured PvP cases. The cap stands. Raise it only after measuring with the perf HUD and a stress match;
record the result in TODO.md.

Local bot matches reuse the same authoritative `World` in match mode, but bots are **not networked**
and do not occupy room slots. A future host-side bot slot is separate work.

### D4 — Identity: program silhouette + glyph, slot palette online (revised 2026-10-29)
Every avatar carries a colored outline with a geometric glyph at its center. The **local** avatar's
outline is split into its health segments (three for most programs; Atomize and Compress have six); a hit
drops that segment to a faint ghost, so the silhouette stays whole and low health still reads at a
glance. Do not hide lost segments entirely. Local bots are player characters too: they draw the same
program hull and health segments, with their own damage. They keep no heading arrow, energy arc or readiness column, and their action effects still
render. Networked guests keep the slot hull until `Snapshot` carries programs.
Enemy damage visuals are undecided, so do not add health pips back for threat families until that pass
happens.

Offline play identifies by **program**, not by slot. Each program owns a hue (`PROGRAM_COLORS`) and a
silhouette from `pathProgramHealth` in `src/game/identity.ts`: Probe is a cyan scan ring with a vector compass rose (`✥` in text), Wedge
an amber diamond with `▣`, Fisher an indigo hex reel with `≈`, Sweep a lime octagon with `✷`, Toxic a green six-point star
with `☠`, Kaboom a red-orange triangle built from three outward triangles with a bomb at the center,
Bad Lag six clock faces on a ring with a pinched hourglass, Atomize three overlapping white
ellipse orbits with an atom at the center, Ghost three outward steel-grey arcs with a closed eye at the
core, Compress six upright Z marks on a ring, Pinball three cabinet-blue flipper bats on a ring with a
vector circled X at the core, and Aim Bot a signal-red scope ring split into three brackets with one inward
tick per health segment. Probe's mark is a vector compass rose (`drawCompassMark`): a thin housing ring around a four-point
star, not the old concentric target. Its four tips are symmetric, so the compass never reads as a facing
arrow. The select screen and the arena share that shape and glyph, so a
program reads the same in the roster, intro and fight. A program's `glyph` may be a single character, a multi-character text combo, Unicode dingbats/wingdings, or a multi-line ASCII picture; `drawSymbol` scales it to the core and portrait, strips common indentation, and measures the real advance against the symbol font stack (`ui-monospace` first, then `Segoe UI Symbol`, `Noto Sans Symbols 2`, `Apple Symbols`, Wingdings, Webdings) so a wide mark shrinks instead of spilling through the hull. Prefer direction-neutral marks: a pointing glyph at the core reads as facing. Each program also owns `coreScale` so a tight hull keeps clearance from its
rotating health segments: Probe `1.12`, Wedge `0.88` (the diamond's sides are the tightest core), Fisher
`1.10`, Sweep `1.06`, Toxic `1.0`, Kaboom `0.76`, Bad Lag `0.72`, Atomize `0.72`, Ghost `0.82`,
Compress `0.8`, Pinball `1.0` (the flipper bats sit outside the core), Copy Pasta `0.8` and
Aim Bot `1.0`. The select portrait applies `coreScale` too, at its own poster radius; do not draw the poster mark at full size or the vector centers overlap their hulls. A wide multi-line ASCII mark sets `glyphRadius` (a fraction of `PLAYER.radius`) and
uses the empty space between the core disc and the hull, with tighter row spacing and a narrower width
budget; a single glyph keeps the default 0.51. The low-health core keeps a scale floor
(`0.78 + 0.22 * coreHp`) so the mark stays visible while the hull ghosts carry the damage read. Check a
new program at full and one-segment health; the mark must not touch the bright hull.

A four-sided hull cannot be split into three equal corner pieces, so Wedge draws one bracket per health
segment at three corners, a short frame-weight tab at the fourth corner, and a thin rim around the square.
The tab and rim keep the silhouette closed at full health without counting as a health segment; keep them
below the health stroke weight. Kaboom does not need that compromise: he has exactly three health
segments, so his hull is three outward-pointing triangles spaced 120° apart. Their points face out, their
bases start outside the core disc, and the three together read as one larger triangle around the bomb.
He draws no frame: the three segments are the whole hull. **Hull clearance is a design rule**: the bright
health path must not cross the center mark or crowd the core disc (max `0.6r` at full health). Kaboom's
bases sit at `0.72r`, fully outside it. Toxic's star tucks its inner vertices behind the opaque disc; that
is the only allowed overlap because the disc covers them and the visible points start at its rim. Atomize's
three orbit ellipses have an inner edge at `0.55r`, so their bright paths stay outside the smaller
low-health mark at every level; at full health the disc hides only the innermost edge, never the mark.
Do not flatten those ovals back toward a narrow atom orbit: that would pull the hull through the center
mark at low health. Do not add a hull whose blades run across the disc; that reads as touching the core. Do not revert to equal
perimeter slices on the diamond, which cut through
corners and read as arbitrary chunks. A five-sided hull has the same problem in a milder form: its slices
cut corners irregularly, so Sweep uses an **eight-sided** hull, where three equal perimeter segments read
as clean arcs. Networked matches still use the slot palette and slot glyphs because the
protocol does not carry programs yet; do not fake program identity in a guest snapshot.

This stays team-ready: a future team mode paints the outline by team and keeps the glyph per program or
player. Do not add per-player customization UI in v1; customization is a later phase. New programs need
an accent, a glyph, a `coreScale`, a hull side count and a select portrait, not a bespoke second identity
system.

### D5 — Feedback is event-driven (decided 2026-10-28)
The host includes an `events` array in each snapshot: shoot, swing, deflect, bounce, explosion, hit, dash,
round start/end, win. Each event is `{ kind, slot, x, y, power, dirX, dirY }`; hit events carry the
knockback direction so every peer sprays directional sparks the same way. Peers use those events for
particles and sound so that everyone sees and hears the same thing. A guest plays its own **shoot /
swing / dash** sounds locally for immediacy; deflect and hit feedback come back with the snapshot
(accepted v1 latency). One additive kind, `DISSOLVE`, marks a projectile that reached its own TTL
without touching a body or cover; it carries the projectile type in `power`, and local FX turns it
into a short shard fizzle. Hits and cover stops keep their own feedback; do not emit `DISSOLVE` for them.

### D6 — Training drone and local bot simulacrum (revised 2026-10-29)
Solo training includes one simple drone: it drifts, fires slow bolts, and respawns. It exists so the
designer can test feel without a second human; do not grow the drone into pathfinding or prediction.

Training has a second program: **endless bot practice**. The player picks 0–3 bots and a tier, and the
room runs in `World('training')` with no rounds or score. `NO BOTS` keeps the sparring drone; any bot
suppresses it. Every dead body, human or bot, respawns on the training timer, so the session continues
until the player leaves. Do not route this through the match round flow.

`SINGLE PLAYER > VS BOTS` runs the same brains through the normal match round flow (`World('match')`,
first to 3). Bots write ordinary `InputFrame`s and are bound by the same single-stick facing, swing locks,
dash cooldown and energy costs as a human. They take the programs the human leaves unused through the
`botPrograms` argument on `World`; online opponents stay Probe because the snapshot does not carry kits.
A live Fisher lure is a decoy for them too: inside `FISHER.lureRadius` it becomes their focus unless the
player is already in their face, so they walk to it and shoot it. There are four difficulty tiers,
labelled `EASY`, `MEDIUM`, `HARD` and `IMPOSSIBLE` (the last is the reserved ceiling), and three styles
(`DUELIST`, `TRICKSTER`, `SIEGE`). They are local opponents, not a future PvE system; do not give them
network authority or direct world mutation. AI-owned bolts travel at `BOLT.enemySpeedMult`; bot lead,
maximum fire range and style engagement range must use that slowed speed, not the human bolt speed. A
program with its own shot speed or TTL must also feed those values into the brain (Bad Lag's 700-speed,
2.1-second hourglass is the current example); do not calibrate it against the generic bolt.
style may not hold outside the distance its own bolt can reach. Bots scale engagement range by program
and commit to program heavies on a cooldown by holding the power button. Wedge bots turn away from a
threat to plant the wall between it and themselves, and place one while reloading; Fisher bots drop the
lure before disengaging and ignore their own beacon when looking for a decoy. Training and VS BOTS keep
separate difficulty preferences.

`?autoplay=N` is a QA-only boot hook: it starts a VS BOTS match with bots in every slot, including
slot 0, and auto-rematches when the match ends. It must stay out of menus and snapshots.
`?playtest=1` is the designer capture hook: VS BOTS with three bots, three completed rounds on each arena
in `ARENAS` order, rotating automatically, with a JSON session log saved after every round and offered as
a download/copy at the end. It is local QA only, never enters menus, `Snapshot` or the service worker
shell, and it must not become the only way to reach a mode. `PLAYTEST.md` documents the log and why a
GitHub token never belongs in the client.
`?gauntlet=1&arena=N&bot=1` is the gauntlet counterpart: it boots a one-life run on an arena and lets a
`BotBrain` drive the local player. With no player target in the gauntlet, `BotBrain.engageHostiles`
walks to the nearest live threat and uses ranged and melee. It is a camera-test pilot, not a PvE ally
controller, and it must not become a menu bot or a networked participant.

Bot movement around cover uses a precomputed 20-unit occupancy grid per arena plus one reusable A*
workspace (`src/game/nav.ts`). Routes are planned on a timer or when the target moves, then shortcut by
line of sight. All path buffers are preallocated per brain; do not allocate or run a full-grid search
every tick. Static floor voids are baked into the nav grid so a route goes around a hole; idle drift and
the chase also steer away from charging emitter lanes. Player movement still treats a void as a drop,
not a wall. The gauntlet/attract pilot also commits to the program's power attack when a target is in
range; without that branch the kiosk loop never showed Wedge's plow (or any other heavy), even though the
duel pilot did. Keep that branch in `engageHostiles`, not only in the player-target path. It must not
begin or hold a rooted heavy while the compactor is warning or active. Do not move pathfinding into
`World.step`.

Bots hold **target lock** while they fight and strafe around a standoff range. The lock keeps facing on
the target, so a shot leaves along facing without the body stepping into it; the spacing error is
continuous (approach far, orbit at the hold range, back off only when crowded). Do not restore hard
"too close" thresholds: they made bots pump straight in and out in place, which read as jitter. The
route is committed for a beat once cover breaks the straight line, and the near-field cover probe is
skipped while a route is active, because running both shoved bots off their own path. Bots also raise
the 180° **guard** on every deflectable incoming shot outside melee reach, not only player bolts: gauntlet
sentry fire is type 3 and missile pods are type 4, and the old type-0 filter made the pilot silently skip
the shield in the attract demo. Close shots are swatted; bombs, mines and bug walls are dodged. Do not
narrow the bot threat filter back to the player bolt type.

### D7 — Networking transport (decided 2026-10-28)
`peerjs` with PeerJS's public cloud broker for v1 and BinaryPack serialization of nested numeric arrays.
No JSON. Room code = 4 base-32 characters → peer id `defl-arena-v1-<CODE>`. Self-hosting the broker and
moving to a dedicated server are later work; record the trigger before switching.

### D8 — Arenas are data (decided 2026-10-28)
All playable geometry lives in `src/game/arenas.ts` as `ArenaDef` records: pillars, ordered spawn points,
accent, floor signature. `World`, `stepPlayerMotion`, the renderer and guest prediction all read the
same definition. The room host selects one and sends the id in `START`; snapshots do not carry geometry.
Do not reintroduce a global `PILLARS` constant or branch collision on map names. New arenas are content
entries, not new systems.

**Arena flow reads left to right (2026-11-03).** Enter a plate on its left side and leave on its right wherever the layout allows; vertical links are the exception, not the default. QUARANTINE's intake bridge used to land on top of the holding plate, which is exactly where the sealed cell block sits, so a body arrived behind the powered bars in a 16-unit strip and could not reach the room at all. The block now sits back-right through `holdingCellLayout`, the intake deck lands on the open left, and the holding-to-mainboard deck joins in front of the cells. Painted bars and bar collision both read that one layout, so they cannot drift apart; `.tmp/holding-layout-check.ts` asserts the landing is left of the block and the exit doorway is in front of it. **Plate inventory (2026-11-03):** only QUARANTINE and CAPCOM are plate arenas. QUARANTINE is checked left-to-right by `.tmp/plate-flow-check.ts` (entry plate intake, exit plate router, three decks, every landing on open floor). Two deliberate non-left-to-right routes are recorded in that check: CAPCOM is a four-plate ring with every deck open by design, so it has no single exit, and TRANSIT is a chasm arena crossed by pads in the west and lifts in the east. Adding a plate arena means adding it to `plate-flow-check`, not just drawing it. `rooms`, `bridges` and `port` are tutorial presentation data, not a second traversal system. **Ingress ports must stand clear of cover (2026-11-03):** a port is an arena `ingress` entry and its square must not overlap a `pillars` rect, or no ranged line reaches it and the port sweep can never be completed. QUARANTINE shipped two ports inside pillars and BUILD ROOT was unwinnable because of it. `spawnCampaignPorts` nudges a buried port to the nearest clear square, but content is expected to place them in the open; keep new ports clear of cover and re-check with `.tmp/port-sweep-check.ts`. Rooms only
draw floor plates, labels and dressing; the matching `traverse.chasms` are the body blockers and the
`traverse.bridges` are the walkable spans. A room arena stays local-only (`isOnlineArena` skips `rooms`)
and never enters host/guest room selection. See D41.

An arena may also carry a `traverse` record: chasms, bridge decks, upper-deck treatment, paired pads and
linked lift plates. Chasms are **body** blockers, not cover: `arenaSolids()` adds them to `pillars` for
bodies, bot pathing, spawns and placement, while projectiles and lasers keep using `pillars` alone and fly
over the gap. A dash is not a phase through solids: it stops on cover, but it is airborne over a chasm,
so a short gap can be cleared. Pads and lifts arm on a
still body after their dwell window, cancel attacks and damage for the ride, and use per-player state
(`travelKind`/`travelT`); they never write geometry into `Snapshot`. A pad holds the body at the source
for the unload half, swaps to the mate at the midpoint, and rebuilds it during the reload half; a lift
moves at the start and is covered by the shrinking-deck transition. `TRANSIT` is the mixed test arena.
Traversal is also the intended route for threats to spill into a later campaign arena (a virus following
a pad across linked rooms); until a campaign runtime exists, pads only move player bodies.

`NETWORK SWITCH` carries two more local fixtures. `pipes` are destructible feed mouths: each alternates a
hostile file box and a small threat, and its intake pulls loose files and small threats into the mouth. A
hostile file is the normal `Prop` record with `hazard` set, so it uses the existing debris physics and
damage path rather than a second projectile system. `firewallSwitch` is a floor plate that starts one
firewall sweep from the opposite wall and rearms after `NETWORK.switchCooldown` (180 s). Both fixtures are
local content: `onlineArenaIndex` skips an arena with `pipes`, and neither fixture enters `Snapshot`. The
compactor, keypad, scanner and browser are not in this group; their clocks are networked under D40.

### ROCKET NAVIGATION reflector (decided 2026-11-02)

The rocket's flown trajectory is a **shot-only dotted reflector**, not a wall. Projectiles bounce off the
active portion of the arc; bodies, dashes, bots and enemy waves pass through it. This is what turns the lane
into a growing crossfire: hostile fire stays alive instead of dispersing on cover, and reflected shots can
cross back over the fight. Do not add `rocketBarrierRects` back to `baseSolids` or `baseDashSolids`; the
field is read only by `bounceRocketPath`. Mines, traps, bombs (8/9), the super ball (15) and the Aim Bot rail
(17) keep their own no-bounce rules. The planned path and the flown path are both drawn dotted; never restore
the solid band. The car route is unaffected and remains body geometry.

### D9 — Gauntlet is a local threat sandbox (revised 2026-10-29)
On explicit designer request, hostiles exist in a **GAUNTLET** mode, not in ranked PvP. It is a test bed
for the eventual PvE direction, not a promise of online PvE. The single exception is INFECTION, which is
solo and host-authoritative online co-op (D32); every other gauntlet threat stays local.

- Enter from the title screen, choose an arena, then begin a one-life run. The ring breaking ends the run
  and writes a local record. There is no practice or respawn option in the gauntlet UI; training is the
  practice mode. A bench/headless practice path still exists internally so the threat pool can be stressed
  without freezing on death.
- A scored record stores callsign, arena, wave reached, seconds survived and kills. Keep the top eight in
  `localStorage` via `src/game/gauntletRecords.ts`; rank by wave, then time, then kills. The gauntlet setup
  stage owns the one-life start and the local table. Records are local-only and never enter `Snapshot`.
- **Worms** are red square chains that damage on touch, swallow projectiles and viruses, and grow a
  segment per meal. They **hold a territory anchor**, patrol it at reduced speed, and only chase a player
  who enters `WORM.aggroRadius` or hits them; interest expires after `WORM.aggroTime` and they return.
  Longer chains move slower. They are **blocked by cover** like the player; only designated phasing threats
  should pass through geometry. A player inside `WORM.biteRange` draws a telegraphed **bite**: the head
  rears for `biteWindup`, lunges at `biteLunge` for `biteActive`, and deals `biteDamage` plus
  `biteKnockback` once before `biteRecovery`. The direction is latched at the trigger, so a strafe, dash or
  broken line of sight can make it whiff; touch damage is suppressed for the whole attack, and
  `biteCooldown` gates the next one. Do not let a worm bite through cover.
- **Viruses** are magenta diamonds that spread, split, and infect. They roam toward `VIRUS.roam*` points
  and only pursue a player or an uninfected worm inside `VIRUS.huntRadius` / `VIRUS.wormHuntRadius`; worms
  are the preferred host. They can convert a worm (magenta, faster) or fill the local player's infection
  meter; at full meter the meter resets to 0.3 and a **thrall** copy spawns nearby. A thrall writes an
  `InputFrame` like any player, so it obeys one-stick facing, swing locks, dash cooldown, burst recharge
  and energy. It uses `players[1]` locally, not a room slot. A virus that has the player between
  `VIRUS.chargeMinRange` and `chargeRange` latches a direction, glows through `chargeWindup`, then dashes
  at `chargeSpeed` for `chargeActive`; the first body hit takes `chargeDamage` and `chargeKnockback`,
  then `chargeRecovery` and `chargeCooldown` follow. Cover and dashes beat the hit, not the commitment.
- **Firewalls** are sweeping orange beams. They warn, then cross the arena and burn players, worms and
  viruses. Pillars cut both the visible beam and its damage; line of sight is real cover. Automatic
  firewalls are **off**. `NETWORK SWITCH` has a manual starter at its west end; standing on it starts one
  sweep from the opposite wall and begins a three-minute rearm. Setting `GAUNTLET.autoFirewalls` back to
  true is still the only ambient firewall source.
- **Cascading errors** are yellow blocks with red exclamation marks. They spread outward block by block,
  damage on contact, and take three hits to delete one block. They are part of the threat pool, not
  arena geometry.
- **Sentries** are the shooting family: pulse squares, nested triplex shotguns, trapezoid homing pods
  whose missiles can be shot down or deflected, and three-dart flocks. They **hold a landing zone** with
  a per-silhouette `leash`; they do not follow the player across the arena. Heavier triplex and homing
  silhouettes move much slower than pulse squares and flocks. They respect cover and line of sight. Packs
  are queued and drop one silhouette every `SENTRY.packStagger` seconds; never dump a whole firing squad
  into the room on one frame. The queue stops at the current wave cap, so a pack cannot push the live
  shooter count past it. The opening pack is two pulse squares through wave 3, placed inside the camera
  window; the cap starts at two and reaches five. Their first shots and repeat cadence are slower for
  those opening waves. Their low-tier bolts are short-lived and **disperse on geometry** instead of
  bouncing. A pulse square or a flock with a player inside `SENTRY.ram.range` breaks its firing cycle for a
  telegraphed **ram** (`windup`, `active`, `recovery`, `damage`, `knockback`). Only one sentry ram
  commits at a time; a three-dart flock must never stack three melee hits on one frame. Triplex and homing
  silhouettes do not ram; they keep their firing band. Cover ends both the travel and the hit.
- Enemy fire is factional. A missed sentry shot can damage worms, viruses, and cascading errors. Sentries
  do not shoot their own pack because a projectile has no source silhouette to exclude safely.
- **Friendly fire is a run rule, not a constant.** GAUNTLET and CAMPAIGN setup carry a `FRIENDLY FIRE`
  toggle (default on, persisted as `deflect.friendlyFire`). On, the crossfire above works as written. Off,
  enemy fire (hostile AI shots and the slot-1 thrall's bolts) passes through worms, viruses and error
  blocks and only threatens players; sentry packs are still ignored because there is no source silhouette.
  The rule never touches environmental damage (firewalls), worm/virus feeding, or the player's own shots.
  It is local-only, set when the run is created, and never enters `Snapshot`.
- Every enemy assembles in over a short spawn window, holds still while its parts arrive, and de-rezzes
  into a size-scaled triangle burst on death.
- **Floating bosses are not floor-culled.** `cullVoidThreats` skips Idle Hands: the palms hover over the
  USB HUB's open gaps, and its own arena-bounds clamp is the only limit. Do not make the hands stand on
  the disc floor or restore the 9,999 void hit, which deleted the whole boss on the first simulation tick
  after its entrance.
- Waves are 30 s and the difficulty ramp is intentionally long: threat families unlock one at a time
  (worms 3, viruses 6, triplex 9, cascading errors 12, homing pods 15, flocks 18) and spawn intervals
  taper across `fullPressureWave` = 120. A new wave does **not** force every threat timer to zero, so there
  is no synchronized dump. Live caps grow with the wave: 2 to 5 sentries, 1 to 2 worms, 4 to 10 viruses,
  4 to 14 error blocks. The opening pack is two pulse squares through wave 3, placed inside the camera
  window around the player so a wide arena does not look empty behind the camera. They hold fire longer
  and cycle slower during those opening waves. Later packs return to one silhouette until their families
  unlock. The mode is a one-life survive-as-long-as-you-can sandbox; there is no final win and no in-run
  respawn. Enemy health is deliberately low; firewalls do extra damage to enemy factions
  (`FIREWALL.enemyDamage`).
- Gauntlet and campaign entities are deliberately absent from `Snapshot` and `NetView`. INFECTION is the
  one exception: a co-op snapshot carries only the shared infection readout and the virus colony. Guests
  render that colony; they never simulate it, resolve hits, or receive worms, sentries, errors, emitters,
  pickups or campaign state. Any broader networked PvE needs its own protocol decision.
- **Co-op infection uses the same host sim.** The lobby `MODE` toggle is host-owned and travels in the
  lobby packet and `START`. The host builds `World('gauntlet', …, infectionMode=true)` with every connected
  operator, spreads the opening flood around their spawns, and targets the nearest live runner. Dead
  operators remain active spectators; the attempt fails only when no runner is left standing. `RETRY`
  rebuilds the host world and broadcasts `REMATCH`; a guest only leaves. Do not give a guest virus
  authority or a second simulation.
- Tuning lives in `tuning/threats.json`, exported as `GAUNTLET`, `WORM`, `VIRUS`, `FIREWALL`, `SENTRY`,
  `CASCADING_ERROR` and `THRALL` from `config.ts`.

### D10 — Four action jobs: ranged, melee, power, skill (revised 2026-10-29)
Player-facing names are plain words, not internal verbs: **RANGED ATTACK** (`X`), **MELEE ATTACK**
(tap `B`), **GUARD** (hold `B`), **POWER ATTACK** (hold `Y`), **SKILL** (tap `Y`), **DASH** (`A`). Use
those names in the settings screen and the game guide. Internals may keep `swing`, `bolt`, `laser` and `bugKind`
(`bug` is the step-based sprite idea, not the action name). The buttons are jobs, not two versions of one
bolt:

- **Ranged attack (`X`)**: Probe's fast burst bolt is five shots, 0.45 s life (~390 units), one bank,
  1 damage, then a 0.2 s recharge. Holding keeps the stream coming at `BOLT.autoInterval`; the low shot
  cost makes sustained fire possible without turning it into a machine gun. Wedge fires a three-shot
  string, Fisher a piercing spear and Sweep a dust-trailing broom that stops on the body and shoves it
  hard. Toxic fires a needle, Kaboom a slow bomb, Bad Lag a heavy hourglass, Atomize an alternating
  electron that leaves one hand and seeks a target in front of it (see D25), Ghost throws a wide
  chomping mouth that is slower than a bolt but hits for two and dazes (see D26), and Pinball throws a
  long-lived ricochet ball whose damage climbs 1-5 across five bodies (see D31). Aim Bot fires a
  2000-speed rail round for 5 damage that dies on the first body or solid and never bounces (see D34).
  Do not restore the old long TTL without reworking the kit.
- **Melee attack (`B` tap)**: the cone is **180°**. Every quick press is a fast spiked lash that sweeps
  the arc left, right, left. It reflects incoming fire and shoves players and hostiles sideways in the
  sweep direction; there is no third-tap shield wave. Facing locks for the lash. The active window is
  generous; an early or far-edge catch still returns the bolt, but angles it and loses some speed. A
  last-instant catch returns it straight. Sweep replaces the shared lash with a **three-hit broom combo**:
  a diagonal push from each side, then a big forward broom on the third tap. The first two damage 1 and
  shove on a diagonal; the third reaches `SWEEP.bigReach` (96), deals 2, shoves straight ahead and
  reflects along the whole drawn shaft. Facing still locks for every hit, and the hold is still the guard.
- **Guard (`B` hold)**: after `PLAYER.guardStartDelay` (0.08 s) the melee button raises a 180° shield
  that reflects every shot in front for up to 1 s instead. A quick tap stays a melee attack and never
  draws shield fill. Each caught shot burns `guardReflectCost`; when the guard or its timer runs out it
  enters a 0.28 s cooldown. Releasing early drops the shield into a 0.12 s release lockout. If target
  lock is holding facing, caught shots flatten toward the locked target instead of following the
  incoming angle. The shield visual is one clean crescent: fill, rim and burn-down edge, with no radial
  fan and no cooldown ghost arc beside the avatar. Pinball's shield is the same 180 degrees but wider
  (`1.65x` reach) and longer (`1.85x` duration); read `Player.guardReach`/`guardMax`, not the globals.
- **Reflected shots:** a catch refills the shot's fuse to `BOLT.reflectTtl` (30 s), so a reflected
  projectile has no practical distance cap and can cross the arena and come back. Speed keeps multiplying
  by `BOLT.deflectMult` up to `BOLT.maxSpeed`, and damage becomes `BOLT.damage + proj.deflects`; two
  catches are 3 damage, enough to delete a three-segment program. The rule applies to guard, lash, bash,
  net and the Pinball arm. This is keyed to the action, not the character: every playable program
  reflects with guard and lash. Fisher's web and Pinball's arm are additional kit-owned reflectors;
  do not gate a shared catch on `PROGRAM_ID.PROBE`. Bombs 8/9 remain unreflectable.
- **Skill (`Y` tap)**: the program's assigned skill, owned by `PROGRAMS` (`bugKind` is the wire field):
  Probe's persistent trap mine (64-unit trigger, 132-unit blast; three live, oldest retired on a fourth),
  Wedge's **static wall**, Fisher's lure beacon, Sweep's **split brooms**. Sweep
  starts two brooms together in front of him and sends them outward along the tangent, shoving bodies and
  hostiles out of the lane before walking through the gap. Wedge plants his bracket shape as
  a solid barrier one body-length behind him (`WEDGE.wall*`): it blocks bodies and reflects shots, so it
  closes the lane he just left and pairs with a backward dash and a flip. It is not a shove and not a free
  projectile delete; a dash still stops at it. A wall that would land in cover is refused and the
  energy is handed back. Legacy kinds `1` trap, `2` wall shield and `3` ghost remain implemented
  prototypes for future programs; do not expose them as a random roll again. The host owns each player's
  skill; guests read it from the snapshot. Atomize's skill raises two blue orbital shield balls: each
  blocks one full hit or damages the first hostile it touches, and they never expire on their own. Ghost's
  skill cloaks the body for a few seconds: enemies lose the target, shots pass through, and damage is
  skipped (see D26). Pinball plants a flipper arm for 16 s that punts hostile fire and swats bodies at
  other enemies (see D31). Aim Bot raises a visible laser sight for 7 s and loads a three-shot clip that
  bypasses the normal reload (see D34).
- **Power attack (`Y` hold)**: program-specific heavy. Probe charges for 0.45 s, then **auto-fires**
  without waiting for release for 3 s, rooted, sweeping at `PLAYER.laserTurnRate` (0.55 rad/s), piercing
  every enemy in the line. The shaft stops on the first solid surface (see D22), and a raised guard
  glances it away at an angle instead of letting it pass. Releasing `CANDLE` after the beam is live cuts it
  short, ends the root and starts the full cooldown; this is Probe only. Wedge plows forward with a bracket; Fisher draws a
  **freeform web**; Sweep materializes a giant broom head by sweeping the lane from the side he faces,
  shoving bodies out of the way before the stroke starts, then damages every body the stroke crosses;
  Bad Lag dilates time; Atomize opens a moving orbit field instead of a beam; Ghost arms a jump-scare,
  then fires it on any action press inside the window or lets it expire. Aim Bot paints up to six red
  crosshairs in a forward cone and fires a 12-damage shot at each in a quick sequence; no volley
  projectile is spawned (see D34). Cooldown starts when the heavy ends. Releasing before the charge
  completes cancels; a release inside `heavyTapMax` uses the skill instead.
- **Dash**: two stored charges (`PLAYER.dashCharges`), one shared 1.8 s recharge. Tap passes through
  enemies and clears floor gaps, but solid cover, deployed walls and sealed cell bars stop it. Hold after
  the tap for the charged triangle dash that damages what it crosses.

Health is a fixed segment pool on the local avatar's program outline (`Player.maxHp`: three for most
programs, six for Atomize and Compress). Bad Lag uses the standard three. One ordinary hit removes one
segment. Do not add a separate health bar beside the avatar; the outline is the local readout. Remotes do
not show segments until enemy/bot health visuals are designed.

**Health is an identity budget, not a balance knob.** Do not change `PLAYER.hp`, a program's
`healthSegments`, or any enemy/threat HP to fix balance or survivability without explicit user approval.
Tune damage, projectile speed and lifetime, cadence, cooldowns, movement and telegraph timing instead.
The existing six-segment Atomize/Compress hulls and enemy HP are grandfathered; they are not permission
to make future health changes.

### D12 — Pickups are local content, definitions are data (decided 2026-10-28)
Healing and timed powerups are a **local training/gauntlet** system for now. They do not enter the network
snapshot, PvP rooms, or the gauntlet→PvE promise. `src/game/powerups.ts` owns ids, labels, colors,
durations, weights, and the weighted roll; `World.updatePickups` owns placement, collection, and the
timer. To add content, add a definition and an effect branch, not a second pickup system.

Most drops come from destroying enemies: small kills use `POWERUP.dropChance`, heavy silhouettes use
`POWERUP.eliteDropChance`, and drops share `POWERUP.dropCooldown`. Training bots use the small-kill path;
gauntlet thralls and threats both feed it. At most `POWERUP.maxActive` (2) sit on the field. Ambient spawns
are a deliberately rare safety net (`firstSpawn` 24 s, then every 42 s).

- `RESTORE_STATUS` repairs the three health segments and clears slow/infection once those exist.
- `MACHINE GUN` turns held ranged fire into a low-damage spray.
- `SCATTER` replaces the ranged burst with a short-range fan.
- `OVERCHARGE` turns held ranged fire into a beam: a short `overchargeSpinup` (0.14 s) plays the heavy
  charge ring at a tighter radius, then the beam stays on while the trigger is held. Releasing switches it
  off on the next frame and leaves `overchargeFade` (0.2 s) of cooling shaft plus a `BEAM_END` ember spray
  along the line, so a quick tap does not read as a light being unplugged. It also triples dash distance
  and replaces the core symbol with a lightning bolt while active.
- `BARBED WHIP` replaces the melee lash and guard with a red lash and multiplies reflect reach and
  damage by four.
- `PATHFIND` turns ranged bolts into axis-aligned seekers that turn at right angles toward the nearest
  target.

Timed effects last 11–15 s and replace each other rather than stacking. Their state is read from the
effect itself (the overcharge core mark is the clearest example); there is no separate powerup bar or
dock cell.

### D11 — Avatar-only telemetry and settings sub-menus (decided 2026-10-28)
The canvas shows no operator name plates or life bars. Health is the rotating segmented outline around
the **local** avatar; energy is the local inner arc. Dash charges, the skill and power-attack marks sit in
one compact **readiness dock**: a dark panel with three large icon cells and cooldown rings, no labels. A solo local keeps it top-left; with several local players one
dock sits in each screen corner (see D18). It is local-only; remotes show no health, energy, heading
arrow or readiness marks. Match state (round, timer, score pips) stays in the bottom strip. The optional
minimap is one shared map: lower-left for a solo view, top-centre when the view is split or more than one
local is active.

The DOM settings screen is tabbed: `FEEDBACK`, `CONTROLS`, `AUDIO`, `SYSTEM`. Persisted options are
callsign, hit rotation, impact flash, scanlines, minimap, **game UI**, controller rumble, auto lock, auto
attack, master volume, soundtrack, SFX, menu sounds, mute, and arena/bot preferences. New feedback options
belong in the Feedback tab, not beside the title menu. The minimap is a small edge-anchored overlay showing cover, every local player
and every local threat family; it is off only by explicit player choice. `GAME UI` hides the whole
canvas UI layer (match strip, wave banners, readiness docks, minimap) for a clean capture without
changing the avatar's own health or lock marks; `?ui=0` does the same for one load and does not persist.
On a gamepad, `VIEW`/`SELECT` toggles the same layer for the session without rewriting the saved choice;
`START` is the only in-game menu button.

**Controller rumble** is local feedback, owned by `src/game/haptics.ts` and gated on the gamepad owning the
current input. It uses `vibrationActuator.playEffect('dual-rumble', ...)` with the older
`hapticActuators[n].pulse` as a fallback; a pad without either is silent, and every promise is swallowed.
Cues and magnitudes live in `tuning/world.json` under `HAPTICS` (`tap`, `guard`, `hit`, `blast`, `heavy`,
`death`, plus `blastRadius`). Own swings and dashes tap, a caught shot ticks, a spent health segment
thumps, a nearby explosion booms, a heavy beam drives a stronger cue, and a death gets a long thump.
Rumble is suppressed in attract/kiosk and stress runs, while a menu overlay or the loading intro is up,
and while the keyboard/mouse owns input. Do not add a second vibration path, put haptics in `World`, or
send rumble through `Snapshot`; this is a local device channel, not game state.

`HOW TO PLAY` is a top-level title option and the only home for control and kit explanations. It detects
connected gamepads and draws a gamepad, touch or keyboard/mouse table; the pad name may appear in that
screen's header. A phone gets the touch table instead of a keyboard table. It carries a short rules section, the program roster and clip tiles that are
placeholders until recorded gameplay clips exist. Keep the explanation here rather than in the other
menu stages: title menus list options, not instructions.

The title is a single console menu, not a dashboard: plain text options, one `>` cursor on the focused
line, no grid backdrop, and no footer links. The ASCII logo header belongs to the hub only; every
sub-stage hides it (`stage-open` on `#screen-title`) so the reclaimed height goes to the stage content.
The hub is `SINGLE PLAYER`, `MULTIPLAYER`, `HOW TO PLAY`, `SETTINGS`; callsign editing lives in
`SETTINGS > SYSTEM`. The Multiplayer stage has exactly two modes: **ONLINE** (host game or join game) and
**LOCAL** (same screen, arena versus). Local's setup stage is the real setup: couch seat rows, an arena
grid, and a start gate that needs one controller beside the keyboard. Seats, drop-in and the split rules
live in D18. Local gauntlet co-op is not built. Public room discovery
is planned around a shared prefix on the 4-character code: a public game opts into the prefix, a private
game keeps an unprefixed code. Do not add that search UI yet. The campaign
blueprint archive is not on this screen. The solo flow is staged and auto-advances: **gameplay mode →
(training/gauntlet: program select; campaign: save slot) → that mode's setup**. Program select is a card
grid that grows with `PROGRAMS`. Training: arena with previews →
bot count → bot tier → start. Gauntlet: arena → run setup → one-life run. Campaign: the story-mode stage,
which offers its three save slots **first**. An empty slot starts a new run: bot count (`NO BOTS` / 1–3),
then player select. A filled slot resumes and skips both steps. Bots take whatever programs the players
leave unused. Choosing a mode or program advances the stage, a chosen arena
advances, a bot count advances, and a tier starts training. Do not add a NEXT/RUN confirmation step back. The
arena grid navigates in all four directions; inside a card grid, a direction move stays in the grid while
a neighbour exists. Gauntlet setup shows the local top-eight table. In-game canvas text is suppressed
except for short wave banners and the Esc/overlay menus.

The level intro is assembly, not a loading screen: ground, frame, cover (dropping in), then player
skeletons and spin-up. Do not add a progress bar back into the intro.

Local readiness marks live in one **readiness dock per local player**, out of the avatar/enemy space:
dash charges, skill, then power attack. A solo local keeps the dock top-left; with more local players the
docks take the screen corners (top-left, top-right, bottom-left, bottom-right). It is icon-only, local-only, and uses cooldown rings rather than text or bars. Give each
program's skill and heavy distinct marks; they share the dock and must not be mistaken for each other.
The dock hides while that local avatar is dead.

Every dock job sits in the same 60px cell and 50px **circular slot** at the same weight, so the three
jobs read alike on every program and at couch distance. Cooldowns are a circular mask: the recovered wedge stays lit and
a dark wedge covers the part still charging, with a bright sweep edge. Do not shrink the marks back to
tiny glyphs inside a big empty box; the box stays 196×64 and the elements inside are deliberately bold.
Ranged ammo pips and the pickup cell are gone: the dock is three jobs, not five.

Do not show the current input device in the in-game UI or as an input-mode badge. `Input` follows the
most recently used device (keyboard/mouse or gamepad) and switches on the next real input. The How to
Play controls panel is the one exception: it names the connected pad because it is explaining that pad.

Console surfaces are sized for a couch, not a desk. At 1080p the main console options are 32px with
~72px rows, stage labels 21px, settings rows 21px, and buttons 21px; secondary text (key hints, card
roles, record columns) never drops below 15px. Keep that scale when adding a menu row or panel. A menu
stage opens with nothing highlighted; the first d-pad or arrow input lands on the stage's first real
option (not BACK), and a resting mouse only hovers once it actually moves. Do not re-add a default
`.nav-focus` on stage entry or focus the first button on open. The short-viewport guard
(`max-height: 780px`) is a compact version of the same scale so the title stage still fits a 720p window
without scrolling back to desktop type. Controller focus must remain visible and is scrolled into view
on navigation; do not reintroduce fixed 7–10px menu text or a second small-button theme later in the
stylesheet. Menu type is a system UI face, not a terminal font: `--ui` lists console-appropriate system
faces (`Bahnschrift`, `DIN Alternate`, `Avenir Next`) then the platform UI font, and the body plus every
menu control uses it. The ASCII logo, terminal boot log and schematic data tables stay on `--mono` so their
columns align; never move the logo to `--ui`, because a proportional face breaks the ASCII block.

### D13 — Sector campaign is an authored graph, blueprint first (decided 2026-10-29)
The five-sector campaign is data, not a branch of `World`. `src/game/sectors.ts` owns the sector records,
arena nodes, and links between them. A node names its prototype blockout with an existing `arenaId`; the
link is a `bridge`, a paired `teleport`, or a shared `elevator`. Boss nodes carry the sector gate.

- The blueprint archive is **blueprint only** and is currently parked with no menu entry while the story
  flow is built. It may draw the topology and describe the fiction, but it must not start a match, enter a
  room, or write a sector into `Snapshot`.
- Keep sector geometry out of the network until a separate protocol decision exists. Today the snapshot
  contract carries match state only.
- `CAMPAIGN.md` is the handoff document for layout sketches and rules. Do not invent a second map format
  in the runtime; when a sector becomes playable, add a node loader around the same `ArenaDef` data.
- New arenas remain content entries in `arenas.ts`. A sector node may reuse one as a blockout, but the
  final layout belongs in the arena record, not in a switch on sector id.
- The campaign is one route through device clusters, not a sector-select screen. The archive tabs exist
  only to review the blueprint; in play, the player clears a cluster and carries the uplink to the next
  system until `ROOT`. Do not turn sector selection into the campaign flow.
- Solo Campaign is **story mode**, entered without a program pick: `SINGLE PLAYER > CAMPAIGN` opens the
  three local save slots (`src/game/saves.ts`) first. An empty slot starts a new run and continues to the
  bot count and player select; a filled slot is a resume and skips those steps. The slot record stores
  level, human `players`, `bots` and the run program, and the readout shows the level plus player count,
  not the program. Bots take the programs the human players do not pick. The run saves after every
  completed level. Slots are local only and never enter `Snapshot`. Do not turn this stage into a
  sector-select screen. The blueprint archive is parked and unlinked while this flow is built; do not
  reattach it to the campaign stage without a decision.
- The first playable node is **BUILD ROOT** (`src/game/campaign.ts`) on `QUARANTINE`; see D17 and D41. It
  is a scripted gauntlet-mode world, saves the slot on clear, and returns to the slot stage. **REBOOT** on
  `GRID ZERO` is the second playable node (v0.1.152): a kitty briefing, a four-kill assault, then the
  Mega Worm as the level's final encounter.
- **A level may end on a mini-boss (2026-11-02).** `CampaignLevel.boss` names the `MINIBOSS` id; `World`
  takes it as `campaignBoss` and spawns it once the assault kills are met (`campaignBossSpawned`). A boss
  node ignores the port sweep and the bare kill count: it clears only after the staged intro and when no
  body of that kind is live, so neither a port nor a fodder kill can end the fight. Mini-boss health is
  not a level budget: do not tune a node by changing it. **A death before the assault is practice (2026-11-02):** every live campaign phase ticks the training respawn, so a body that falls into a chasm or gets caught during calibration, release, briefing, drill or breach comes back and the lesson keeps its progress; only a death in the assault ends the run. Ticking that timer during the drill alone left a body permanently dead in calibration, which stalled the lesson with no overlay to leave from.
- The campaign route plate (`road.ts`) belongs to the between-level transition, not to the archive. Do not mount it in a menu.
- **Narrative framing (first beat built 2026-11-01, v0.1.92)**: the run opens in the quarantine section of a dev
  system. Every roster program is a "bad" program pulled by antivirus and sent to be retrained; the pick is
  choosing which inmate to run. Story arrives in bottom-screen text boxes whose speaker head is a floating
  emoji/Unicode/Wingdings mark: 👮 THE WARDEN (the LOCALHOST sector boss, not a separate character), 🐱 a
  friendly program who gets the players out when the infection breaks, and the User/Users AI antagonist at
  ROOT. Narration is **live over play** (never pauses `World`), reveals near-instantly, and is skippable per
  line and per beat; campaign setup carries a persisted `STORY BEATS` skip toggle beside `FRIENDLY FIRE`.
  Beats are cosmetic and must not gate gameplay, or a skipped replay would diverge. Cast, presentation rules
  and open questions live in `CAMPAIGN.md`. Narration is local presentation only: no new `PROGRAMS` entries,
  hulls, hitboxes, `World` bodies or `Snapshot` fields.
- **Orientation (built v0.1.92)**: `src/game/tutorial.ts` owns a reusable `TutorialRunner` and the first
  two lessons. `BUILD ROOT` opens with `WARDEN_TUTORIAL`: move, dash, fire, lock, cycle (`R`/`F` on
  keyboard, `RB`/right stick on pad), melee, then catching one harmless test shot. The six calibration
  subjects stay dormant in holding until the player arrives, then wake as wave 1; `CALIBRATION_SKILL_TUTORIAL`
  teaches the skill. Clearing wave 1 powers the sealed cell block down and
  `CALIBRATION_POWER_TUTORIAL` teaches the heavy over wave 2 (two viruses and a worm). `REBOOT` opens
  with `KITTY_TUTORIAL`: tap skill, then hold the power attack. Narration lines auto-advance; action
  steps wait for the input; `SKIP TUTORIAL` ends the lesson and the level continues on the same beat.
  The story box is DOM, live over play, and local-only; it never pauses `World` and never enters `Snapshot`.
- **Campaign spine (decided 2026-11-02)**: the run is **island hopping**, one network at a time. Land, clear
every infection you can find on that island, and the uplink opens the crossing to the next network. The
infection is the enemy's footprint; the campaign's objective is to find and delete the **rogue AI agent**
behind the spread, which sits at `ROOT` inside `THE SUCCESSOR`. Sector order, arena ids and crossing names
are unchanged — they are the islands — and an island's clear condition is its infection count rather than a
bare kill count, shared by the objective strip and the sector exit. This does not answer how the agent
presents on screen. Detail and open questions live in `CAMPAIGN.md`; do not build a sector-select screen
around it.

### D14 — Sweep.exe: broom push kit, clean core mark (built 2026-10-29)
`SWEEP.EXE` is the fourth program and the roster's **shove** specialist. Identity: lime accent, an
eight-sided hull, and a `✷` eight-spoke burst at the core. The mark search is closed for now: the only
literal broom is the colour emoji `🧹` (ignores `fillStyle`, so a brown bitmap lands inside a one-hue
silhouette), and Wingdings has no broom at all across its 224 glyphs. Of the monochrome "clean" marks that
survived, the four-point sparkle `✦` thins to a faint plus at the ~11px the core gets, so the burst is the
pick. The kit carries the broom: the core mark only has to say "clean". Revisit only if a monochrome broom
is drawn as vector paths.

- **Melee**: a three-hit broom combo replaces the shared lash. Diagonal pushes on hits one and two, then
a bigger forward broom. Every hit locks facing and the hold is still the guard. The third hit reflects
along the full `SWEEP.bigReach` shaft, not just `PLAYER.swingReach`. The broom is drawn upright in front
of the avatar (binder on top, bristles under it) and strokes **straight up and down** across the lane; it
does not swing on a curved arc, and the head never turns over. Hit one strokes down, hit two back up.
- **Ranged**: a thrown broom head at `SWEEP.shotSpeed` (650, slower than a bolt but fast enough to
trade shots). It is wide
(`shotRadius` 18), does 2 damage, stops on the body and shoves hard (`shotKnockback` 1200, the biggest
ranged shove in the roster), and **dies on geometry** rather than ricocheting. It draws no line trail and no handle: just the same upright comb as the melee, with the
bristles at the bottom, plus a short puff of grey square dust from `emitBroomDust`. It is type `6`, so every `type >= 3` hostile check must stay an explicit
`=== 3 || === 4` or equivalent before adding another player projectile type.
- **Power**: the giant broom is generated **in front of the player** (`SWEEP.powerFront`). The head
materializes from the facing side first: `SWEEP.powerRevealTime` (0.3 s) is a directional reveal, not a
hit. Only the part of the lane that is already visible shoves, and bodies under it are pushed toward the
reveal front with `SWEEP.powerRevealPush` (820) and take **no damage**. The reveal clips left to right
when `cos(facing) >= -0.15` and right to left otherwise; the direction is latched when the heavy fires so
steering during the charge cannot flip it. After the reveal the stroke begins: it rises one
`SWEEP.powerRise` and comes back down the same lane **twice as far** over `SWEEP.powerDuration`, so the
return clears the ground below the player as well as the rise above. The head is a screen-wide character
comb (`SWEEP.powerSpan` half-width) that damages each body once and carries it with the stroke
(`SWEEP.powerCarry`), pushing up on the rise and down on the return so victims are not dragged toward the
caster. Cover cuts the contact and the reveal shove. Cooldown starts when the stroke ends.
- **Skill**: two brooms start together in front and split along the tangent to `SWEEP.fanReach` over
`SWEEP.fanLife` (0.62s, deliberately slow), shoving bodies outward and clearing the lane. Both stay
upright with the bristles down, draw no dust tail, and hit each body once per cast; cover still cuts the
contact.

All four broom shapes are drawn with **real characters**, not stroked polygons: a binder row
(`/=====\`) over three dense bristle rows (`|||||||`), cached per size and stretched to span the head,
so the arena attacks and the core mark share one visual language. Keep the `✷` burst at the core: the
two-row ASCII picture was tried there and turns to mush at core size, and a text mark inside the octagon
read worse than the star. The heavy and melee brooms stay upright with the bristles at the bottom.

Displacement reuses the shared `kx`/`ky` slide, `PLAYER.knockDrag` easing and the existing square slide
dust; do not add a second knockback system. All numbers live in `tuning/programs.json` under `SWEEP`. Bots own
the kit like any other program: the generic heavy hold builds the sweep, and a dedicated branch taps the
split brooms at 50–210 units. Sweep is local-only for now; online matches still run Probe because
`Snapshot` does not carry programs. Do not add kit fields to the snapshot without a protocol decision.

### D15 — Toxic.exe: venom, needle, spray and jet (built 2026-10-29)

`TOXIC.EXE` is the roster's **poison** specialist (id 4, `VENOM`). Identity: `PROGRAM_COLORS.toxic`
(`#3dff6e`), a six-point star hull, and a `☠` core. The star has twelve equal edges, so the three health
segments cut cleanly with no frame rim; the trim is half an edge at each segment end.

- **Ranged**: a cheap needle dart (type 7) drawn as a **hypodermic**, 1 direct damage plus venom. It
  is geometry (`drawSyringe`: flange, plunger, barrel with a venom window, hub and a long needle), not
  the `†` mark, which read as a cross at projectile size. It does not bounce and carries no motion tail;
  a small green halo is the only glow. Its damage is deliberately small because the venom is the payload.
- **Venom**: 3.5 s, one tick every 0.75 s for 0.4 (about two-fifths of a segment). A hit refreshes the whole
  duration instead of stacking. Poisoned bodies get a pulsing green rim and a flashing `☠` above the
  body — a status mark, not a health pip, so it is allowed on bots and remotes too.
- **Skill**: a 360° burst at the cast point, damaging and poisoning every body inside `sprayRadius` with
  cover cutting line of sight. It reads like the death shard burst, but the shards are **circles** and
  they keep coming for the whole `sprayLife` (particle kind 5, `P_COLOR_TOXIN`).
- **Power**: a rooted, aimable **jet**, not an instant cone. Charge 0.56 s, then `streamTime` 1.25 s of
  narrow stream that ticks venom damage every 0.2 s. The body cannot move for the burst, but the stick
  steers facing at `streamTurnRate` (2.4 rad/s) — faster than the heavy beam, because a stream has to be
  walked onto a moving body. It stops at cover for both damage and the drawn shaft.
- **Bots**: a dedicated close-range branch taps the spray inside `sprayRadius`; the generic heavy-hold
  builds the jet.

Venom on gauntlet threat families is not modelled; the spray and jet damage them, but worms, viruses,
sentries and error blocks cannot be poisoned yet. Do not add poison fields to `Snapshot`; the kit is
local-only like every other program.

### D16 — Kaboom.exe: bombs, lob and a carpet spray (built 2026-10-30)

`KABOOM.EXE` is the roster's **bomber** (id 5, `BOMBER`). Identity: `PROGRAM_COLORS.kaboom`
(`#ff5a3d`), a hull of three outward-pointing triangles spaced 120° apart, which reads as a triangle made
of triangles, and a bomb core. Each triangle is one health segment, so there is no frame-only piece and
no rim. The center mark and every shell use the Wingdings bomb (`M`) when the family is really
installed; on a host without Wingdings, `drawBombMark` draws a vector shell instead so the core never
reads as a letter. `document.fonts.check` alone reports true for missing system families, so
`hasSymbolFont` also compares glyph advances against a definitely-missing family.

- **Ranged**: one slow bomb (type 8, 360 u/s, 2.0 s life). It does no direct-hit damage: it explodes on a
  body, on cover, or at the end of its fuse, and the blast (64 radius, 1 damage, 520 shove) does the work.
  Cover is real for the blast, so a shell that lands behind a pillar clears nothing.
- **Skill**: a heavy bomb lobbed in an arc (type 9, `lobTime` 0.62 s, `lobRange` 300) that flies over
  pillars, lands at the target distance, and detonates for 2 damage in a 116 blast. It also explodes on
  the first body it meets.
- **Power**: five lobbed shells in a shallow fan (`clusterSpread` 0.24 rad) that land as a row about 150
  units wide. They are released left to right with `clusterStagger` 0.07 s between shells, carried in the
  projectile's `grace` field, so the power reads as a continuous string or spray rather than five orbs
  appearing on one frame. Each shell has its own 66 blast and 1 damage; overlapping blasts are intended.
- Bombs are **not deflectable**: every `proj.type >= 3` deflect/guard/net branch must exclude types 8 and
  9 explicitly, or a caught shell would turn into a bolt. A bomb that hits cover dies there and detonates
  on the same frame.
- **Blast FX are only red and orange** (`P_COLOR_BLAST_RED` / `P_COLOR_BLAST_ORANGE` in `particles.ts`):
  an `EV.EXPLODE` never uses the shooter's slot colour and never emits white, while a body death keeps its
  threat tint and white shards. Do not put the owner colour or white back into the explosion, or a
  detonation reads as another death burst.
- **Hull**: three short fins start at `0.72r` with a 0.56 rad half-base and `coreScale` 0.76, so no health
  segment touches the core disc or the bomb mark. The clearance rule is in D4. Do not grow the fins back
  toward the core to make them read bigger; the silhouette, not the size of one blade, carries the identity.
- Bots lob when a target sits between 90 and `lobRange + 60`; the generic heavy hold builds the carpet.
  The kit is local-only like every other program; do not add bombs to `Snapshot` fields.

All numbers live in `tuning/programs.json` under `KABOOM`.

### D17 — First campaign node: BUILD ROOT; REBOOT parked (built 2026-10-30)

The campaign's live level is `BUILD ROOT` on `QUARANTINE` (`src/game/campaign.ts`); `REBOOT` on `GRID ZERO`
is authored but marked `playable: false` until the next route segment ships. They run in a
`World('gauntlet')` with `campaign = true`, so it reuses the threat simulation and stays local-only; the
mode string stays `gauntlet` so no threat branch forks. The script lives in `World`, not in `main.ts`.

- **Calibration**: after the Warden's orientation lesson the node holds six dormant geometric subjects,
  two each of a blue circle, a red triangle and a yellow rectangle, in the square **HOLDING** office. The
  class wakes together when the player reaches holding (or after `CALIBRATION.entryWait` 18 s, so a player
  who ignores the prompt cannot soft-lock the node), on a node without an intro after
  `CALIBRATION.wakeDelay` (6 s), inside `CALIBRATION.wakeRadius`, or on the first hit; killing them while
  dormant is deliberately not allowed, because the eye opening is the lesson. The class forms two columns
  in the holding office's lower half, leaving the centre lane for the bridge entry. Waking also hides the
  three holding civilians, marks their loss with a short burst, and starts `CALIBRATION_SKILL_TUTORIAL`:
  tap the skill while wave 1 is live. A dormant shape is plain geometry; awake, it
  carries a small red eye and each primary owns one attack: the circle dashes and bounces off walls and
  cover; the triangle never holds still, drifting on a wandering heading at `floatSpeed` while it keeps a
  loose `floatRing` band around the player and turns off a wall before the clamp catches it, so it reads as
  a watchful parent behind its cloud of sixteen tiny seeking triangles, which churn around the player and
  bite on contact (do not anchor it to one loop: an anchored float becomes a stationary target as soon as
  the fight moves); the rectangle does not spin, bobs
  lightly, clones itself directly left and right into an axis-aligned row, then the whole row commits to
  one very fast shared dash. This pack is deliberately **untelegraphed**: no lane, arrow or link lines,
  because the switch from passive to attacking is the fear beat. The cell block is a solid body while
  it is sealed. Clear all six and finish the skill beat to make the block fail: `beginCellRelease`
  removes the bar solid, retracts the bars and spawns wave 2, two viruses and a worm, in the cells.
  `CALIBRATION_POWER_TUTORIAL` then asks for the heavy; clear wave 2 and finish that lesson before the drill.
  The six reuse sentry kinds 4-8 so every player weapon already hits them, but calibration kills pay no score or
  pickups, no parents wake the assault counter, and arena emitters stay parked for the whole prologue.
  Everything lives in `CALIBRATION` in `tuning/campaign.json`.
- **Tutorial route**: `QUARANTINE` stages the basic lesson, the dormant-class reveal and the cell release
  across four linked rooms; see D41. The six subjects wait in the holding office, not in the player's
  opening circle, and script_kitty is behind the middle cell bars.
- **Drill**: 18 s of sparring against the run's bot squad, using the same `BotBrain` inputs as training and
  VS BOTS. A `NO BOTS` run still gets one instructor so the drill has a partner. Death on either side
  respawns on the training timer. The squad forms an arc `CAMPAIGN.drillRing` in front of the player and
  respawns on that arc, so the drill is a spar in arm's reach instead of a cross-map jog; the ring steps
  outward, then inward, and falls back to the nearest clear arena spawn on a small island. The player
  keeps the gauntlet spawn so a drill knockdown respawns inside the spar. No threats exist yet.
- **Breach**: a 3.4 s `SYSTEM BREACH` warning. The squad de-rezzes, live projectiles clear, and the local
  player is healed to full for the assault. The squad is gone for the rest of the node.
- **Assault**: the opening sentry pack lands on the breach beat, then worms arrive, then a new pack every
  14 s. Campaign waves start at 3 and step every 14 s, so viruses arrive after about 40 s. Clearing 10
  threats clears the node; one death fails it. The objective strip at the bottom is one pip per delete.
- **Completion**: a clear writes the save slot (`level` = completed count, `program`, `players`, `bots`,
  seconds) and shows the clear overlay. With only BUILD ROOT live, the overlay reads `MORE LEVELS COMING
  SOON`, the slot shows `COMPLETE`, and `STORY SLOTS` / `REPLAY` are the actions. Nothing is saved
  mid-level. A failed node offers RETRY and SLOTS. `PLAYABLE_CAMPAIGN_LEVELS` is the live list; do not
  re-enable a parked level without checking its clear path.
- **REBOOT (parked)**: script_kitty's briefing on `GRID ZERO`. It opens with `KITTY_TUTORIAL` (tap skill,
  then hold the power attack) with no threats in the room, then starts the breach and a four-kill live-fire
  check. Keep `playable: false` until the route after BUILD ROOT is authored and tested.
- **Bots are the drill squad, not allies.** `World` has no team model for bot companions yet, so do not
  fake allies by disabling friendly fire. Team ownership is the prerequisite for bots that fight beside
  the player after the breach.
- Campaign numbers live in `tuning/campaign.json` under `CAMPAIGN` and `CALIBRATION`. The node identity, arena blockout and
  sector link live in `campaign.ts`; never put node geometry in a switch on level id.
- Everything here is local, like the gauntlet. Nothing campaign-shaped enters `Snapshot`.

### D18 — Camera frames the group, fit-first split, rigs, death spectate (revised 2026-10-30)

The camera is part of the read, not a fixed follow. All numbers live in `tuning/world.json` under `CAMERA`.
`src/game/camera.ts` owns the rig director; the renderer owns framing, grouping and viewports.

- **Group framing**: every local pane anchors on the bounding-box centre of the local players in that
  pane, not on one avatar. Other live players, the training drone, worms, viruses, sentries and
  cascading-error blocks inside `CAMERA.focusRange` pull the frame by a distance-weighted mean offset,
  capped at `CAMERA.maxBias`; the pull skips the pane's own locals. The anchor is then clamped to the
  middle band (`CAMERA.edgeMargin`); an arena bound can still pin the camera first.
- **Fit first, then split**: local players stay on one screen while their whole group fits at
  `CAMERA.sharedZoomMin` (0.68x the base) with `CAMERA.groupPad` around the box. Only when that maximum
  pull-back cannot hold everyone does the view split, and then into the smallest number of panes: the
  farthest pair peels apart repeatedly until each group fits a pane. Four players with one across the
  arena become two panes, not four; a tight trio shares a pane. `CAMERA.shareSlack` is the merge
  hysteresis. One pane is full screen, two side by side, three or four on the 2x2 grid. Do not replace
  this with a fixed pairwise distance: a wide pair can legitimately share a screen, and a trio plus one
  outlier must not cost three extra panes. A dead local is a spectator and does not count toward the
  fit; a corpse across the arena must not split the survivors' screen.
- **Dynamic zoom**: `CAMERA.zoomMin` and `zoomMax` are the combat multipliers; a pane also uses
  `CAMERA.splitZoom`. A single shared view may pull past combat zoom to `sharedZoomMin` to fit the
  group. The exact cap also includes `CAMERA.groupPad`, so an avatar is never left on the pane edge.
  Zoom eases separately (`zoomFollow`). Kit numbers stay in world units (`SWEEP.powerSpan`,
  `SENTRY.spawnView*`), so their screen coverage is approximate as the camera zooms; do not move camera
  state into `World` to make an attack screen-sized. Tune the multipliers, not a hidden knob.
- **Pane frames and HUD**: each split pane has a 1.6px outline in its primary local player's color over
  a dark underlay, plus a faint inner line. That outline is what makes two similar floors read as two
  windows. Readiness docks are per local player at screen corners: top-left for a solo view, then
  top-right, bottom-left and bottom-right as locals join. One shared minimap serves the whole screen:
  lower-left for a solo view, top-centre whenever the view is split or more than one local is active, so
  it does not belong to one pane. It shows every local player and all threat families.
- **Layout slow motion**: when the pane count or grouping changes, the renderer raises a one-shot
  `layoutChanged` flag; the local sim dips to `layoutSlowScale` (0.35) and holds that scale for
  `layoutSlowHold` (1 s), then eases back over the rest of `layoutSlowTime` (1.3 s). Network play and the
  stress bench never slow.
  The camera keeps moving at real speed while the sim dips; the point is to give the eye time to find the
  avatar before a shot lands.
- **Rig director**: `CameraDirector` holds four reusable rigs (`CameraRig`: world point or `followSlot`,
  zoom multiplier, hold/in/out, weight, priority). The highest priority wins, blends over the default
  framing, and hands control back on expiry. `Renderer.playCameraRig` is the API for a boss entrance or
  a narrative beat. Shipped cues: a gauntlet wave glances at the nearest sentry pack outside
  `CAMERA.waveLookAhead`; the campaign breach pushes in 8%. Keep cues short and opt-in; a full blend may
  leave the avatar off frame on purpose.
- **Split scope (local play built)**: `Renderer.setLocalSlots([...])` is fed by `LocalSeats`
  (`src/game/localplay.ts`). P1 is keyboard + mouse; every detected gamepad is adopted automatically as
  P2–P4, on the setup screen and mid-match. A drop-in calls `World.joinLocalPlayer`, which activates a
  spare slot, keeps the kit already assigned by `botPrograms`, and spawns at the arena point farthest
  from the field. A disconnect keeps the seat and body through a 0.9 s grace, then zeroes that slot's
  frame; reconnecting the same pad index resumes it. Frames are written per slot into `localFrames` and
  passed straight to `World.step`; pads never drive P1 (`Input.keyboardOnly`). One readiness dock per
  seat, per-pad rumble, and the shared/split camera follow automatically. `?split=N` remains a QA visual
  hook outside menus. Slots that are not active fall back to the primary slot. World effect emitters
  (slide/broom/toxic dust, projectile and dash trails) run once per frame; only their draw calls run per
  pane. Local seats, pad ids and frames never enter `Snapshot`; online rooms still have no local slots.
- **Death spectate**: `damagePlayer` records the attacker family and index (`SRC`) on every hit. While a
  local slot is dead its camera follows a surviving campaign drill partner first, then the killing body
  (player, worm, virus, sentry, cascading error or training drone), then the nearest living player. A
  firewall has no body, so that death falls through to the player fallback. Respawn and pad swaps snap the
  camera instead of panning across the arena. Team modes need a real team field before the ally branch can
  cover them; today the campaign drill is the only ally-shaped group.

### D19 — An arena chooses a wall or a drop (built 2026-10-30)

`ArenaDef.walls` is `'solid'` (the default) or `'open'`. It is arena data, like pillars and spawns, so
nothing forks: the host sim, guest prediction, bot edges, the renderer and the picker preview all read the
same flag. Walled arenas keep every old rule. Do not make it a mode flag or a room setting; the map owns it.

- **Open means the floor ends at the bounds.** `stepPlayerMotion` skips the wall clamp, and `World` turns a
  body whose centre crosses the lip into a fall (`SRC.VOID`). The fall runs through the ordinary death path,
  so it loses the round, counts as the local death in the gauntlet/training and fails a campaign node.
  Invulnerability does not buy a floor: a dash's or a hit's iframes are cleared before the kill. A ride on a
  pad or lift still owns the body.
- **A shove is a kill.** Sweep's broom, Wedge's bash and plow, bombs and the melee lash already push bodies;
  on an open arena that push can carry one over the line. Threats are pushable too: the worm, virus and
  sentry bounds clamps are skipped, and anything past the lip is deleted through its normal damage path, so
  it still counts toward the gauntlet/campaign clear and drops its pickup. Sentries do not get a free leash
  past the edge: the drop takes them like anything else.
- **Nothing ricochets off nothing.** A shot that reaches the lip dies there; committed shapes (spear,
  thrown broom, bombs) keep their geometry death, so a bomb still detonates at the edge. Bots refuse a dash
  whose committed end point lands past the lip, and steer back from the edge over a `lip` band of 130 units
  (`avoidFurniture`), because their walled 44-unit nudge is not enough without a wall.
- **Read it before you step on it.** The lip draws as a dashed line over a black void band that swallows the
  floor grid, with inward chevrons; the minimap and the arena preview use a dashed rim. The camera may show
  `CAMERA.voidMargin` (90) units past the lip. Spawn rings on an open arena must be inset; never place a
  spawn on the lip.
- **THE LEDGE** (id 6) is the first open arena. Turning another arena open is a content change: check its
  spawn ring, its cover layout and how its bots behave near the drop before shipping it.
- **A fall is not instant, and it is survivable.** Crossing a lip, a trapezoid slant or a hole edge starts
  `FALL.grace` (0.6 s) instead of killing on that frame. The body hangs, keeps 62% steering against a
  74 u/s pull toward the hole (outward on a lip), and is **saved if it gets back on the floor**. Attacks are
  locked and knockback is cleared for the grace. The ordinary death path still runs when it expires, so
  rounds, records and campaign failure are unchanged. Do not shorten this to a one-frame check: the whole
  point is that a body shoved to the edge has one beat to save itself.
- **`slant` makes a trapezoid plate.** `ArenaDef.slant` pulls the side edges in by that many units at the
  top; the bottom keeps the full bounds. Outside the slant is a drop, not a wall, and `offFloor` is the one
  test the player, threats and debris all use.

### D20 — Destructible plates, light debris and data (built 2026-10-30)

Wedge's wall and the file boxes are the first destructible objects; most environment is still solid and
should stay that way. Damage reads as **shake + three crack stages**, never a health bar.

- **Wedge's wall is solid, not shoot-through.** Every shot type stops or reflects on it; only the lobbed
  shell (type 9) is airborne over it. It has `WEDGE.wallHp` (7): ordinary shots chip 1, spears/brooms/bombs
  chip 2, a lash chips 1, a blast chips 2, and at zero it de-rezzes (`EV.WALL_BREAK`). Its cracks are drawn
  along the segment; its hit shake is a 3 px normal offset. The heavy beam also stops on the plate (D22);
  it does not chip it. Do not give shots a way through without deciding that the wall is weaker.
- **File boxes are debris, not cover.** Rounded dashed outlines say "this moves". They are pushed by
  bodies, launched by the melee lash without being deleted (2 hp, so the second hit still breaks one),
  batted by a raised guard, shoved by shots and blasts, swept by the compactor and never overlap each
  other. Motion is a target velocity with a 6000 u/s² ramp and low drag: ease in, long glide, ease out.
  Keep them off shared arenas until the snapshot carries them; a host-only prop would desync a guest.
- **The campaign has data crates.** `campaign.ts` authors them; `World.spawnCampaignData` adds them on the
  breach, so the drill squad cannot break the objective before the assault. `dataTotal`/`dataKept` feed the
  end-of-level score (kills, data, time vs par, damage taken, clean-sweep bonus) and the score, best score
  and clean-sweep count persist in the save slot. Nothing campaign-shaped enters `Snapshot`.
- **A compactor is arena data.** `ArenaPusherDef` owns the cycle: warning, travel, retract, the stop line,
  thickness and the housing band. The arm is a moving wall: bodies are glued to its face (`ky = 0`) and
  pinned on any ledge below the stop line. It must stop at a meaningful line (RECYCLING BIN stops on the
  hole's rim), never at a place that cuts the last safe ground in half. A compactor arena ships with no
  solid cover, because the plate would pin bodies against it instead of pushing them.

### D21 — BAD_LAG.EXE: hourglass throw, fast-forward, dilation (built 2026-10-30; renamed v0.1.51)

`BAD_LAG.EXE` is the roster's **time** program (id 6, `BUFFER`). It was renamed from
`BUFFER_OVERFLOW.EXE` on 2026-10-30; the id, tuning key and color key stay `BUFFER` so saves and
snapshots do not move. Identity:
`PROGRAM_COLORS.buffer` (`#ff6ec7`), six clock faces on a ring, and a pinched hourglass at the core.

- **Hull**: six clock faces, two per health segment, orbiting at `0.78r` with a `0.17r` radius. Each
  face carries a minute and an hour hand at its own angle, so the ring reads as a set of times rather
  than a row of dots. Losing a segment removes two whole clocks; the rest stay bright, and the lost clocks
  still ghost like every other hull. The inner edge is `0.61r`, just outside the `0.6r` core clearance.
- **Core**: the hourglass is vector, never the `⧗` codepoint. U+29D7 resolves to a colour emoji on some
  systems and paints an opaque tile into the core, so `drawHourglassMark` draws two rounded triangles
  pointing at each other with their tips overlapping (`0.18h`) to make the waist. It uses only the
  caller's fill colour, and its corners are rounded with `arcTo`. `coreScale` is `0.72`, so the mark
  keeps clear air between itself and the clock ring. **Do not draw the dark core disc behind it**: Bad Lag
  is the one program whose mark is a solid filled shape, and a disc behind it reads as a black tile. The
  renderer skips the disc for `PROGRAM_ID.BUFFER` only.
- **Ranged**: one heavy hourglass (type 10), `740 u/s`, 2.1 s life, wide (`14`), no motion tail, dies on
  geometry. It passes through up to five bodies (`BUFFER.shotHits`), damaging each for 1.75 and shoving
  hard (`780`); every body struck flips `spinDir`, so the mark visibly reverses. It uses the spear's hit
  masks per family, and a worm swallows it. Every `type >= 3` deflect branch may turn it into a bolt,
  which is the existing guard/lash rule; types 8/9 remain the never-deflectable exceptions.
- **Skill**: **fast-forward** for `3.8 s`. Movement, attack rate and every cooldown run at `2.8x` for
  that body only. It is driven by `Player.fastT` (local-only) and a per-player `pdt` that scales
  cooldown/attack timers; `Player.speedMult` scales walking only, so dash and plow keep their committed
  distance. The duration runs on the real clock. Its skill cooldown is 7.5 s.
- **Power**: **time dilation** for `6.2 s`. Every body except the caster, every hostile projectile, and the
  whole gauntlet/drone simulation run at `0.25x` (`World.timeSlowT`/`timeSlowOwner`). The field runs on
  the real clock and never enters `Snapshot`; a guest never sees it because online still runs Probe. The
  charge takes 0.45 s and the cooldown is 7.25 s. The renderer washes the frame edges in Bad Lag pink while
  it is live and marks the caster's dock as the live heavy.
- **Bots**: tap fast-forward when a target sits 40–320 units away; the generic heavy hold builds the
  dilation. Bot lead and engagement range use the true 740-speed, 2.1-second hourglass. Both ride the same
  `InputFrame` path as a human.
- **Durability**: three health segments, the standard roster pool. The kit has no shield, burst clear or
  escape skill; survivability comes from the faster/longer fast-forward and the stronger dilation, not a
  larger health pool. Do not add a health segment without explicit user approval.

All numbers live in `tuning/programs.json` under `BUFFER`. The kit is local-only like every other program.

### D22 — The heavy beam is a surface, not an infinite ray (built 2026-10-30)

`beamReach` in `src/game/collision.ts` is the one reach test for the heavy beam. Pillars, deployed Wedge
walls, the compactor plate and a walled arena's bounds end it; a chasm or an open lip does not. Both
`World.applyLaserDamage` and `Renderer.drawLasers` call it, so the drawn shaft and the damage line stop on
the same surface instead of the old render-only 25-unit probe. The beam does not chip a wall it stops on.

A raised guard in the corridor (front half-plane, same rule as the projectile catch) catches the beam and
glances it away. The reflected shaft leaves at `PLAYER.laserReflectAngle` off the incoming line (0.65 rad
≈ 37°, inside the intended 30–45° band) and reaches `PLAYER.laserReflectRange` (380). It is one pass of
its own beam: every body on the deflected line takes `PLAYER.laserDamage`, but the **caster and the guard
are both skipped**, so a guard can never be used to hit its owner. The catch also cuts a charged heavy
into its full cooldown; the caster takes no damage from the catch itself.

The guard draws the deflected shaft for `PLAYER.laserReflectFlash` (`beamReflectT` / `beamReflectFacing` /
`beamReflectDist`). Those fields are local only, like every other program kit effect: the snapshot carries
the `EV.DEFLECT` event, so an online guest gets the flare and sound but not the drawn shaft. Do not turn
the beam into a projectile to reuse deflect code; its occluders are geometry, not bodies.

Arena emitters reuse the same guard catch and visual fields, but their return leaves along the guard's
facing instead of this 37° glance. See D27.

### D23 — Title attract demo and kiosk boot (revised 2026-10-30)
When the hub sits idle for `ATTRACT.idle` (24 s) the title hands the screen to a **bot-run gauntlet**
attract demo: a random program, a random arena, and a run seeded `ATTRACT.wave` (72) waves in so every
threat family is live and every live cap is at its pool maximum. The canvas UI is forced off for the
demo; the title DOM hides and the game canvas takes the screen. Any key, pointer click, wheel or gamepad
edge ends it and returns to the hub with nothing highlighted. `?attract=1` boots it for QA; `?demo=true`
boots the kiosk variant described below.

- The demo is **presentation only**. It is a `World('gauntlet')` with `attractMode = true`, never a scored
  run, never a campaign node, never a room. It writes no record, and `syncPhaseUi` suppresses every
  overlay while it runs. Do not route its result through the gauntlet record or the save slots. A demo
  death still sets `gauntletOver` so the pilot knows to restart, but `World.step` only freezes on that flag
  outside attract mode: keep the death aftermath simulating for `ATTRACT.restart` seconds instead of
  holding the last frame. Real gauntlet, campaign and hosted runs keep the freeze.
- `World.seedAttractRun` jumps `gauntletT` to the target wave, then `fillAttractRoom` fills sentries,
  worms and viruses to the current caps around the player; error blocks come from the normal colony
  growth. While `attractMode` is set, a 5 s refill keeps the room at those caps (`ATTRACT.refill`) so the
  demo never thins out between the normal wave timers. It reuses the normal spawn paths, so assembly,
  sound and the threat simulation are unchanged.
- The pilot is an ordinary `BotBrain` at the HARD tier in slot 0, driven through the same `InputFrame` as
  a human. Do not give the demo a second control path or special-case world mutation.
- Hover does not wake the demo: a layout change can fire a synthetic `pointermove` under a resting
  cursor. Hover only resets the idle clock; keys, clicks, wheel and pad edges end the demo.
- The demo must stay out of menus and must not leave settings or `renderer.showUi` in the demo state when
  it exits; `uiEnabled` restores the saved choice.
- **Kiosk boot (`?demo=true`, also `1`)** is the same pilot for a display or a capture: it ignores every
  wake input instead of returning to the hub, restarts the run after a wipe, and shows one centered
  `DEFLECT_` wordmark in the title/menu ASCII face. It is the logo and the blinking caret only: no mode
  label, room line or subhead. The card fades in at the top of each 60 s cycle, holds long enough to read,
  then clears the screen so the gameplay owns it until the next minute. It is `pointer-events: none`, so
  the page has no click target. The body hides the cursor in this mode.
  There is no pause, menu or exit path; leave it by reloading without the parameter. It writes no record,
  opens no overlay and never persists the demo UI state. Keep the card DOM-only so a capture shows the
  same title without turning the canvas UI back on, and keep it out of `Snapshot`/`NetView`.
- **Squad rotation**: consecutive attract/kiosk runs cycle through one, two and three local pilots
  (`ATTRACT.squadSizes`). Each is an ordinary local slot with a `BotBrain` writing its `InputFrame`; do not
  add a second demo-only control path. Three-player runs pick a compact solid arena
  (`ATTRACT.wideSquadArenaMax`) so the whole arena fits one shared pane and the camera never splits the
  showcase. Squadmates in an attract run are local bodies, not enemy thralls: they respawn on the training
  timer and their deaths do not count as kills. A scored run still has one local slot.

### D24 — Tuning data lives in JSON (decided 2026-10-30)
All feel, timing and damage numbers live in `src/game/tuning/*.json`, split by ownership:
`player.json` (avatar, bolt, skill, mine), `programs.json` (per-program kits), `threats.json` (gauntlet
families), `campaign.json` (authored node pacing and score) and `world.json` (camera, arena traversal,
powerups, rounds, training, net and attract). `src/game/config.ts` is a typed facade that imports those
records and re-exports the old names, so no system imports JSON directly.

- JSON has no comments. Rules and invariants stay in this document and in code; the JSON only carries
  descriptively named values. `tuning/README.md` maps the files, units and derived fields.
- Keep **structural constants** in `config.ts`: engine limits, view size, pool sizes, the render palette,
  `TRAVEL` state values and `TRAIL_LEN`. Those are not feel knobs.
- Keep **derived values** in `config.ts` too: `PLAYER.swingHalfAngle`/`guardHalfAngle` are `PI/2`, and
  `SWEEP.powerRise`/`powerSpan` derive from the view so a camera-zoom change still resizes the broom.
  Do not bake their current results into JSON.
- `config.ts` is imported at build time; there is no runtime fetch. That keeps snapshots, bot determinism
  and the PWA cache unchanged. A JSON edit hot-reloads in `npm run dev`; production needs a rebuild.
- To add a placeholder value, add it to the relevant JSON object. A brand-new top-level record also needs
  one import and one export line in the facade. Do not reintroduce tuning literals in `config.ts`.

### D25 — Atomize.exe: alternating electrons, orbital shield, orbit field (built 2026-10-30)

`ATOMIZE.EXE` is the roster's **orbit** program (id 7). Identity: `PROGRAM_COLORS.atomize` (`#ffffff`, the
one neutral outline in the roster), a six-segment hull, and an atom at the core. `healthSegments: 6` on
the `ProgramDef` is the one source of the larger pool; `World` sets `Player.maxHp` from it and every spawn,
respawn and damage read follows. Do not hard-code six in the damage path.

- **Hull**: three overlapping ellipse outlines turned 60° apart, each split into two half-arcs, so the
  three ovals make six health segments. `pathProgramHealth` owns the geometry. The ellipse inner edge is
  `0.55r`, which keeps the bright path outside the low-health core mark at every level; the opaque core
  disc hides only the innermost edge at full health. Do not flatten the ovals toward a thin atom orbit:
  that would pull the hull through the center mark. `coreScale` is `0.72`, and `drawAtomMark` draws the
  nucleus and three orbit strokes in vector, so the `⚛` codepoint can never land as a colour emoji.
- **Ranged**: one electron per throw, alternating hands (`Player.atomSide`). The ball spawns from the left
  or right side of the body with the launch angle tilted **inward** by `ATOMIZE.shotArcAngle`, so the two
  shots cross the body before the seek bends them forward. It is type `11`, `480 u/s`, 0.72 damage, no
  geometry piercing. `findAtomTarget` picks the nearest body in a forward cone (`shotSeekRange`,
  `shotSeekDot`) with line of sight, and `steerAtomBolt` turns toward it at `shotTurn`. The ball cycles
  yellow, green and blue; its long white trail is what draws the arc. Cover blocks the seek, so it cannot
  curve through a wall. Do not route type 11 through `steerPathBolt` (the PATHFIND powerup's axis search);
  it carries `homing` as a seek flag, and the path steer is type 0 only.
- **Skill**: two blue balls take an orbit at `ATOMIZE.ballOrbit` and spin at `ballSpin`. They have no
  timer. Each ball is spent on the first hostile body it touches (1 damage, `ballKnockback`) or blocks one
  full hit on the avatar before health or campaign damage is recorded (`damagePlayer` checks
  `atomBalls`). Venom chip and the void are not full hits and are never shielded. A second tap while any
  ball survives is refused and the energy is handed back. The count is the readout: no timer, bar or
  extra dock cell.
- **Power**: a moving **orbit field** for `powerDuration` (2.8 s), not a rooted beam. `startOrbitPower`
  charges the normal heavy button but does not set `laserT`, so the caster keeps walking. Every projectile
  except mines, traps and bombs inside `powerGrab` is pulled onto a ring (`powerOrbit`, tangent spin
  `powerProjectileSpin`); its owner is rewritten to the caster so it can hit enemies and other players but
  never its own caster. In the gauntlet, sentries and viruses are captured too, with per-kind weights
  (`sentryWeight`, `virusWeight`) scaling their orbit and spin speed. Captured bodies are held out of
  their own AI, damage each other and any player they touch (`powerContactDamage`, 0.4 s cooldown), and
  collide with cover. Release is a tangent throw with spread (`powerThrow`/`powerRelease`), so the field
  ends by flinging everything outward in a semi-random arc rather than fading. Cooldown starts when the
  field ends (`powerCooldown`). Bots tap the skill when a target is close and let the generic heavy hold
  build the field. All numbers live in `tuning/programs.json` under `ATOMIZE`.

The kit is local-only like every other program. It does not add fields to `Snapshot`, and online matches
still run Probe until the protocol carries programs.

### D26 — GHOST.EXE: cloak, chomping mouth, jump-scare (built 2026-10-30)

`GHOST.EXE` is the roster's **stealth** program (id 8, `bugKind` 11). Identity:
`PROGRAM_COLORS.ghost` (`#b9c4d0`, cool steel grey), three outward arcs for the health hull, and a closed
eye at the core. The eye is drawn by `drawGhostEye` as a vector lid with five lashes, never the `◡`
codepoint, so it cannot resolve to a colour emoji or depend on the symbol font; `◡` is only the text
metadata glyph. Its orientation is the bottom-half arc with the lashes hanging below. The hull arcs start
at `0.69r`, curve out to `1.34r`, and leave 120° gaps, so each arc is one health segment and the bright
path never touches the core mark; `coreScale` is `0.82` so the lashes keep clear air from those arcs.

- **Ranged**: one wide chomping mouth (type `12`) thrown at `GHOST.shotSpeed` (540, about 40% slower than a
  bolt), 2 damage, `shotRadius` 16, 0.9 s life. It stops on the first body and on cover (it is a committed
  shape in the same geometry-death group as the spear, broom, hourglass and bombs), and it draws the same
  jaw with sharp triangle teeth the whole program uses. A hit dazes the victim: `shotDaze` 0.7 s at
  `shotDazeSlow` 0.55 movement. The daze is a heavy-footed slow, not a root, so the victim can still turn
  and answer late.
- **Skill**: `cloakT` for `cloakTime` 3.2 s. `phased()` gates `damagePlayer`, so shots, blasts and
  contact damage skip the body; AI target picks and sentry/worm/virus acquisition skip a cloaked player,
  while the local renderer keeps a faint dashed readout so the owner can navigate. Attacking does not break
  the cloak. A fall takes the cloak with it: the floor is not a hit and does not respect iframes. Cloak and
  the legacy skill-3 ghost timer share the same hit gate; do not add a second invisibility flag.
- **Power**: hold the heavy for `scareChargeTime` 0.45 s to re-cloak and arm the jump-scare for
  `scareWindow` 3.0 s. While armed, **any** action press (`BOLT`, `SWING`, `CANDLE` or `DASH`) fires it,
  after which the press is consumed so the same button cannot also act; if the window expires it fires
  nothing. The burst is a cover-respecting `explodeBlast` at `scareRadius` 210, 2 damage and
  `scareKnockback` 1200, drops the cloak, and stamps `SCARE_FACE` at the burst point for `faceTime`
  0.85 s. It is also an **eviction**: `evictJumpScare` throws every surviving player, sentry, worm and
  virus still inside the ring out past the radius plus `scareClearance`, using each family's own
  `knockDrag` (`need * drag`, because a decaying knock travels `v0 / drag`) and skipping the outward speed
  a body already carries. Cover still cuts the wave, a body on a pad/lift is left riding, and a dormant
  calibration subject is left asleep. Cascading-error blocks stay rooted; do not give them a knock channel.
  The charge costs `scareCost` and starts `scareCooldown` when it arms. A release inside
  `heavyTapMax` is the cloak skill instead.
- **Bots**: tap the cloak when a shot is in the air or after a hit, hold the heavy when closing to scare
  range, then chase and press melee once armed. Bots cannot see a cloaked target and re-pick.
- **Renderer**: the mouth has no motion tail and chomps with a per-projectile jaw phase; the cloak is a
  dark disc, dashed rim and faint eye with a heading tick; the armed state adds a pulsing ring and a very
  faint burst radius for the owner; the scare face is ASCII art with O eyes and V teeth over a grey bust.
  The dock uses the closed eye for the skill and an open maw for the heavy.

All numbers live in `tuning/programs.json` under `GHOST`. The kit is local-only like every other program;
it adds no `Snapshot` fields and online still runs Probe.

### D27 — Arena laser emitters are local hazards with a full-shield return (built 2026-10-30)

`ArenaDef.emitters` is the data for wall-mounted laser fixtures: `{ x, y, angle, offset? }`, where `angle`
is the firing direction and `offset` is a phase in cycles (0..1) for the shared clock. `World.emitters` is
built once from that list. The first fixtures are on CROSSROADS, THE RING and MAINFRAME; RECYCLING BIN has
none because the compactor already owns that floor. All numbers live in `EMITTER` in `tuning/world.json`.

- **Cycle**: gather for `EMITTER.gather` (2.4 s), fire for `duration` (0.42 s), rest for the remainder
  of `period` (7 s). A pair with offsets 0 and 0.5 alternates instead of firing together, and the phase
  stays staggered when `period` is tuned. The short live window is deliberate: the beam is a dodge beat,
  not a sustained wall the player must leave the arena to avoid.
- **Local only**: `updateEmitters` runs in training and gauntlet practice and returns in `match`, so a
  hosted room never arms an emitter even when the map carries one. No emitter state enters `Snapshot` or
  `NetView`; do not add it without a protocol decision.
- **Direct pass**: the shaft starts at the lens, uses `beamReach` so pillars, deployed walls, the
  compactor plate and a walled bound stop both the draw and the damage, and lights every player in the
  corridor for `EMITTER.damage` (1) with `EMITTER.knockback`. It burns a body once per pass, respects
  line of sight, and skips iframes, pad/lift travel and cloak. A death records `SRC.EMITTER`, which has no
  body, so the death camera falls through like a firewall. The direct shaft is a player hazard; it does
  not damage threat families.
- **Guard return**: a raised guard anywhere in the corridor, facing the lens (front half-plane, same rule
  as a projectile catch), catches the shaft. The direct line stops at the shield and the return leaves
  along the guard's `facing`, **not** the heavy beam's 0.65 rad glance. That is what lets target lock send
  the beam at a locked enemy. The return is one `damageBeamLine` pass at `EMITTER.reflectDamage` (2) and
  `EMITTER.reflectKnockback`, range `EMITTER.reflectRange` (1200), and skips the guard, so a catch can
  never hit its owner. It can hit threats, the training drone and other players. A second guard is not a
  reflection chain; this is one catch and one return.
- **Drawing**: a dark wall bracket with two prongs and a red lens; during the gather, red dots and short
  radial streaks fall inward, with a shrinking ring. The live shaft is stacked red layers with a hot white
  core, side rails, a muzzle flare and an impact flare, all clipped to `beamDist`. Red side sparks come
  from `Renderer.emitLaserSparks`, not from `World.step`. The arena card preview and the minimap mark
  every emitter, so a player can see the lane before the first shot. Never draw the hazard in a player
  program color.
- **Placement**: mount on a solid face and fire into open floor. Do not put a lane over the local start
  point or a required route. THE RING fires through its top and bottom gates because its side gates hold
  the spawn pair; MAINFRAME offsets its two lanes clear of the y=720 spawn line. Check the spawn ring
  whenever an emitter is added, and do not add emitters to an arena whose only cover makes the lane
  unavoidable.

### D28 — Phone touch layout and local input assists (built 2026-10-30)

This is the first mobile framework, not a second control system. `touchMode` turns on for a coarse
pointer and can be forced with `?touch=1` or suppressed with `?touch=0`. It is presentation and local
input only; no touch state enters `World`, `Snapshot` or a room.

- `src/ui/touch.ts` owns a DOM stick at the bottom left and three hold-capable buttons at the bottom
  right: **SHIELD** (`ACTION.SWING`), **SKILL** (`ACTION.CANDLE`) and **DASH** (`ACTION.DASH`). The stick
  has a 0.18 deadzone and writes the same movement vector as a pad. Buttons write ordinary held and
  pressed bits, so the simulation cannot tell a phone from a controller. Pointer up, cancel, blur and a
  hidden tab release every held touch.
- The layer only exists during a live local or guest game, with no overlay and no loading intro.
  Menus, the attract/kiosk demo and the stress bench hide it and release the stick. It is input, not
  readout UI, so `GAME UI` and `?ui=0` do not remove it; without the controls a phone has no way to move.
  The pause button opens the ordinary leave overlay, and STAY restores the layer.
- Settings > Controls stores `deflect.autoLock` and `deflect.autoAttack`. Both default **on** for a
  touch device and **off** for a keyboard/pad session; an explicit saved value wins, and RESET DEFAULTS
  follows the current device. Auto lock holds the ordinary target lock. Auto attack writes LOCK and,
  once a target is active, presses melee inside `AUTO_ATTACK.meleeRange` or holds ranged fire inside
  `AUTO_ATTACK.rangedRange`. It never overrides a held manual action, an active swing/guard/dash, an
  armed jump-scare or a running heavy. This is a local input assist, not bot AI; a guest can only
  assist against player targets because snapshots carry no other bodies.
- The touch layout is renderer/HUD only: `Renderer.touchLayout` moves the readiness docks to the top
  centre and suppresses the minimap. The avatar's own health, lock and action marks are unchanged. The
  stick and buttons use `env(safe-area-inset-*)`, so a notched phone keeps clear of the glass edge.
  Menus remain the existing DOM screens.
- Not included: a second stick, a touch cycle-lock button, a mobile-only menu, portrait-specific
  layout work, haptics or a local same-screen second player. Keep assist tuning in `AUTO_ATTACK` in
  `tuning/player.json`; do not scatter touch ranges through `main.ts`.

### D29 — COMPRESS.EXE: pressure orbs, size dash, pressure burst (built 2026-10-30)

`COMPRESS.EXE` is the roster's **pressure** program (id 9, `bugKind` 12). Identity:
`PROGRAM_COLORS.compress` (`#c46bff`, archive orchid), a six-segment hull of six upright capital **Z**s on
an orbiting ring, and a vector **press** at the core. The hull ring sits at `0.8r` with a `0.17r` half-height
per letter, so the inner edge is `0.6r` and no Z crosses the full-health core disc. The letters stay
**upright** while the ring turns: rotating each Z with its angle turned four of the six into Ns and
sideways strokes, which broke the "six Zs" readout. `coreScale` is `0.8`. The core is `drawCompressMark`:
a threaded screw drives a heavy jaw down onto a block on the base plate, drawn in vectors so the mark is
monochrome on every host. `⊟` is only the text metadata glyph. Do not replace the press with the `⊟`
codepoint in the arena or the portrait.

- **Ranged**: one pressure orb (type `13`) at `COMPRESS.orbSpeed` 560, 1.05 s, radius 9, 1 damage and
a 340 shove. It is a grouped shape with no motion tail, drawn as a ring with a downward caret (the
"one size down" mark). A hit squeezes the victim: `shrink *= 1 - shrinkStep` (0.15, floored at
`shrinkFloor` 0.35), and the health cap drops by `max(cap * hpCut 0.10, hpCutFloor 1)`, never below 1,
with current health clamped to the new cap. The cap change is **permanent until the body respawns**, not
a status timer; `clearPlayerForSpawn` restores the program's segment pool and `shrink = 1`.
- **What shrink touches**: a player's `shrink` scales the drawn hull, segments, core mark and heading
arrow, and the projectile and bomb hit radii, so the smaller body is genuinely harder to hit. Cover and
arena-bound collision still use `PLAYER.radius`; do not read that as the body being full size. Sentries
and viruses shrink their `radius` field directly, which moves both the draw and every hit test that reads
it. Worms carry `shrink` for the drawn head/chain only; their contact, bite and collision radii stay at
the `WORM` constants. Cascading-error blocks have no size field and only lose health.
- **Skill**: `shrinkT` for `skillTime` 3.5 s. Walking speed is multiplied by `skillSpeed` 1.85 and the
body draws at `skillScale` 0.62 on top of any persistent shrink, with a squeeze ring and four inward
chevrons. It is a speed window, not a dodge: no iframes, no hitbox change, and shooting, swinging and
dashing all still work. Costs the shared `BUG.cost`; its cooldown is the 13th entry in `BUG.cooldown`
(7 s).
- **Power**: hold the heavy for `powerChargeTime` 0.6 s to fire a radial **pressure burst** centred on the
body (radius `powerRadius` 230, cooldown `powerCooldown` 8 s). Every body inside — players, local bots,
sentries, viruses, worms, cascading errors and the training drone — loses half its size (`powerScale`
0.5, floored) and half its health cap; a body already at **1 health** is crushed outright and de-rezzes
through its normal damage path. Players round the new segment cap (`3 → 2`, `6 → 3`); everything else
keeps the fractional cap the draw ratio already understands. Survivors take no direct damage: the shrink
and the cap are the payload. Cover cuts the wave (`lineBlocked`), a pad/lift ride owns the body, a
dormant calibration subject stays asleep, and the caster is skipped. Rooted cascading-error blocks cannot
be pushed, but the burst can still crush or halve them.
- **Bots**: hold the heavy when the target is inside `powerRadius - 30`, because the burst is centred on
Compress and folding empty floor is a wasted cooldown; tap the skill to close or leave a 120–420 unit
gap. They otherwise follow the shared heavy-hold and target-lock rules.
- **Dock**: the skill mark is a small box with speed ticks behind it; the heavy is four inward arrows
collapsing on the body. The heavy's charge draws a contracting ring with eight inward ticks plus a faint
dashed `powerRadius` circle, not a beam muzzle. The `EV.COMPRESS` event (`power` = new scale, 0 for the
burst) drives a purple squeeze pop or the wide burst ring; `P_COLOR_COMPRESS` is the palette entry.

All numbers live in `tuning/programs.json` under `COMPRESS`. The kit is local-only like every other
program: it adds no `Snapshot` fields, a guest does not see a shrunk body, and online still runs Probe.

### D30 — DISK PLATTER: round floor, moving holes, read arm (built 2026-10-31)

`DISK PLATTER` (id 8) is the first **round** arena. `ArenaDef.disc` owns the platter: radius, spin,
authored polar holes and the read arm. It implies `walls: 'open'`; the square bounds only frame the
camera. `offFloor` owns the floor test, so players, bots, threats, props and the drone all agree on where
the plate ends. Do not add a second circular-bound check in a family branch.

- **Holes are disc-local.** Each `DiscHoleDef` is `{ a, r, radius }` in the platter's own frame. World
  angle is `a + discT * spin`, so the geometry is deterministic from one phase and needs no per-hole
  update. `voidAt` returns a bounding rect for the existing fall pull, which means the 0.6 s hang already
  aims at the hole the body is over. Holes are 38–56 units and sit 300–520 from the spindle, clear of the
  hub and inside the 560 spawn ring. Shots fly over them, like a trench.
- **The spin is local-only.** `World.discT` advances only outside `match`, because `Snapshot` carries no
  disc phase. A hosted room keeps the round plate and the static authored holes but parks the arm, so a
  guest cannot be killed by a hazard it cannot see. Do not add disc phase fields to a snapshot without a
  protocol decision.
- **The read arm** is a fixed pivot just outside the rim, an arm `reach` fraction long, and an angle that
  follows a sine over `period`. It **shoves, never damages**: contact separates the body, adds the
  tangential carry for that frame, and sets `kx`/`ky` in the sweep direction. One pass covers players,
  worms, viruses and sentries. A body pushed over a hole falls; a body pushed past the rim falls. Do not
  turn the arm into a damage plate or move its pivot to the spindle (the real hardware pivots outside the
  platter, and the arm crossing the hub is what makes the lane read).
- **Threat containment is rim-only.** `containDiscThreats` clamps worms (head and segments), viruses and
  sentries to `radius - bodyRadius` after every family update, with a fresh clamp after the campaign
  calibration shapes. It deliberately does not save a body from a hole: the hole kill still goes through
  the normal damage path and counts for the clear. Bots steer off the rim and the current hole positions;
  the idle no-hostile drift has its own hole steer because it never reaches `avoidFurniture`.
- **Projectiles and beams** die at the rim. `bounceWalls` reads the circle in the open-wall branch, and
  `beamReach` ends the heavy shaft at the plate edge. They still cross holes.
- **Render** is one round plate: clipped board floor, concentric servo tracks and 24 sector seams turning
  with `spin`, three platter arcs, the spindle hub, cut holes with a lit lip, and rotating rim ticks. The
  read arm is drawn with its pivot housing, shadow, beam and head. The minimap and the picker preview use
  the same helpers, so a thumbnail, the map and the arena cannot disagree.
- **Numbers** live in `arenas.ts` on the arena record, not in `tuning/`: DISK PLATTER is radius 690,
  spin 0.075 rad/s, arm period 11.5 s, sweep 0.55 rad, thickness 44, push 360, reach 1.06. Spawns are an
  inset ring at radius 560. Check the hole ring against every spawn at phase 0 and keep every
  hole's outer edge inside the spawn ring: spawn 5 once sat on a hole, and a hole that crossed 560
  killed an idle start in under 10 s.

### D31 — PINBALL.EXE: ricochet ball, flipper arm, giant ball (built 2026-10-31)

`PINBALL.EXE` is the roster's **ricochet** program (id 10, `bugKind` 13). Identity:
`PROGRAM_COLORS.pinball` (`#4d8bff`, cabinet blue), a three-flipper hull, and a vector circled X at
the core. The X is drawn (`drawPinballMark`), not the `⊗` codepoint, so the stamp is identical on every
host and at every hull size; `⊗` is only the text metadata glyph. The three health bats use
`pathPinballFlipper`, the same tapered paddle as the deployed skill arm. Melee replaces the shared lash
with a two-flipper snap hinged at the body's sides. The ranged and super balls are solid glossy spheres
with a fixed top reflection, not chrome rings. `coreScale` is 1.0 because the bats sit outside the core.
Do not put the mark behind the hull segments at low health.

- **Three dodges.** `Player.dashMax` owns the charge cap (2 for every other program, `PINBALL.dashCharges`
  3 here). Recharge, respawn and the readiness dock all read `dashMax`; do not restore a global
  `PLAYER.dashCharges` check or a Pinball body will refill to two.
- **Wider, longer shield.** `Player.guardMax` and `Player.guardReach` are set when the program is
  assigned. Pinball's shield is `1.85x` duration and `1.65x` reach; world resolution, the drawn crescent
  and the barrier-bat path all read the player fields, not the `PLAYER` globals. It is still the same
  forward 180 degrees; do not widen the half-angle past `PI/2`.
- **Ranged**: type `14`. A long-lived ball (`shotTtl` 4.2 s, `shotSpeed` 520, radius 7) with a
  `maxBounces` cap of 24, not the bolt's one. Every wall, pillar or barrier bounce raises speed by
  `shotBounceGain` 1.10; every body hit raises it by `shotHitGain` 1.08; both cap at `shotSpeedMax` 1480.
  It passes through bodies, one pass each, and the damage ladder is `1, 2, 3, 4, 5` over five hits
  (`shotHits`), retiring on the fifth. This is a commitment line, not a bolt: keep type 14 out of every
  committed/heavy list in `bounceWalls`, `bounceBarriers` and `bouncePillars`, and give it its own bounce
  cap through `noteBounce`. It bounces off Wedge's wall (chipping it) and dies at an open arena's lip.
- **Skill**: a deployed **flipper arm**. The base is a fixed world point `armOffset` in front of the body
  when cast, and stays there for `armLife` 16 s even if the player walks away. It sweeps `±armArc` at
  `armSwingRate`; the paddle is a tapered segment of `armLength` and `armWidth`. A hostile shot it touches
  is sent at the nearest other enemy at `armProjectileSpeed` 1150 (bombs keep their shell type; every
  other shot returns as a plain bolt). It swats one body at a time on `armHitCooldown` 0.2 s for 1 damage
  and a 1500 shove aimed at the nearest *other* enemy, with cover still respected by the damage path. It
  is local-only and lives on `Player.arm*`; do not add a flipper to `Snapshot`.
- **Power**: hold the heavy for `powerChargeTime` 0.7 s to launch one giant ball (type `15`, radius 46,
  3 damage, 7 s, 430 u/s). It bounces off **arena walls only**: it ignores pillars, Wedge barriers, webs,
  props and bodies, and it is excluded from guard/swing reflection. It rolls over each body once with a
  1500 shove and never stops on a hit. Do not put type 15 into the pillar/barrier bounce lists; the
  separation is what makes it a super rather than a bigger ball.
- **Bots**: engagement distance uses the ball's own speed and TTL (not the bolt's 310-unit range), and the
  brain plants the arm when the target is 90-360 units away. The generic heavy hold builds the giant ball.
- **Dock**: the skill mark is a pivoted flipper bat; the heavy is the circled X with speed ticks. Both are
  distinct from the core mark's plain circle-X.

All numbers live in `tuning/programs.json` under `PINBALL`; the skill cooldown is the 14th entry in
`BUG.cooldown` (16 s). The kit is local-only: no snapshot fields, online still runs Probe.

### D32 — INFECTION: a timed swarm clear (built 2026-11-01)

`SINGLE PLAYER > INFECTION` is a timed clear built on the gauntlet simulation; the same rule runs as
online co-op from the lobby's `MODE: INFECTION`. It runs `World('gauntlet', …, infectionMode=true)` and
keeps the `gauntlet` mode string, like the campaign, so no threat, camera or overlay branch forks. The
arena is flooded with viruses that hunt across the whole floor and keep budding; the run ends when the
last body is gone or every runner's ring breaks.

- **The readout is the mode.** `infectionProgress` is `kills / (kills + live)` and is capped at 99% while
  any virus lives, so a fresh bud visibly sets the clear meter back. Only an empty floor reaches 100%.
  The renderer draws one top-centred bar with `VIRUS CLEARED`, the percentage and the run clock; the
  gauntlet's bottom possession strip is suppressed. `gauntletTime` is the run clock. Do not replace the
  derived meter with a fixed kill quota: the colony's growth is the pressure.
- **The tide enters from the right.** Operators spawn on one left-side line (`leftSpawnFrac`), not on
  rings. `INFECTION.startViruses` (24) queue in a vertical column just beyond the right lip, and every
  infection spawn (opening and split) reuses an inactive pooled body at that edge. Do not place opening
  viruses around the players; the right-to-left crossing is the mode's read.
- **Entry is a recycled glide.** `spawnVirus` overrides infection spawns to `bounds.right + radius + 8`,
  gives the body negative `vx` (`entrySpeedMult`) and uses the existing `spawnT` window to glide it in.
  `updateVirus` must move while `spawnT` is above zero, and `cullVoidThreats` / `containDiscThreats` must
  skip entering bodies until they are inside the floor. This is a moved pool entry, not a new entity.
- **Fake density.** `Virus.swarm` adds zero to two drawn satellite diamonds around the one hitbox. They
  are animation only: never collision, health, kills or extra pool slots. The field travels to guests as
  the eighth virus snapshot value, so co-op renders the same colony. `swarmChance` is the tuning knob.
- The pool is `INFECTION.maxViruses` (44) rather than the gauntlet's 10, and one split lands every
  `growInterval` (1.6 s) while under the cap. Viruses use `INFECTION.huntRadius` (whole arena) and
  `speedMult`, not the gauntlet's 310-unit interest radius. Do not reuse the gauntlet's wave ramp here.
- **The swarm bites, it does not joust.** The single-target charge is disabled in this mode: the whole
  pack committing one lunge each was a three-second death for a stationary player. Contact does
  `contactDamage` (1) and `contactKnockback` (540), then sets a shared `hitGrace` (0.85 s) so the pack
  cannot stack a kill on one frame. The gauntlet's contact-infection meter and thrall spawn do not run;
  `addInfection` returns early. Keep the bite in `updateVirus`'s contact branch, not a new system.
- **No random help.** Pickups are off (`updatePickups` returns early and virus kills do not drop), and
  friendly fire is forced off when the run starts so the colony cannot thin itself for free. Best times
  must not depend on a powerup roll. Arena emitters and floor hazards still run: they are part of the
  arena's identity and of the route.
- **One life each, one shared clear.** A death only downs that runner; in co-op the body stays on the
  roster as a spectator and the attempt fails when no runner is left alive. A clean sweep sets
  `infectionCleared`, a wipe sets `infectionFailed`, and both set `gauntletOver` through the existing
  freeze path. `infectionOver` is the single test for the results hook in `main.ts`.
- **Co-op wire format.** The host owns the colony, clock, kills and clear meter. `Snapshot` carries an
  optional `infection` row and compact virus rows (`swarm` included); `NetView` mirrors the readout and interpolates the
  swarm for rendering only. Dead guests keep receiving snapshots. The host records the clear; a guest's
  overlay offers `LEAVE ROOM`. Host `RETRY` rebuilds the world and broadcasts `REMATCH`. Nothing else
  from the gauntlet enters the packet.
- **Records.** `src/game/infectionRecords.ts` keeps one best time per arena under
  `deflect.infection.bests`, in `m:ss.d`. A failed run is never recorded; a clear only replaces a slower
  time. The title menu shows the fastest clean sweep across arenas. Records are local and never enter
  `Snapshot`.
- **Entry and QA.** The solo flow is `INFECTION → program → arena → run` (no bot stage, no setup stage), so
  a chosen arena starts the run. `?infection=1&bot=1` is the QA boot hook: the local body is driven by a
  `BotBrain` and the arena must not enter menus or snapshots. Retry, arena and title actions live in the
  result overlay; the run is never saved mid-attempt.

Tuning lives in `tuning/threats.json` under `INFECTION`; the mode identity and records live in
`infectionRecords.ts` and `main.ts`. Solo runs stay in the local `World`; online co-op uses the same host
simulation and the narrow infection snapshot described above.

---

## 3. Architecture

```
index.html            DOM screens (title, settings, lobby, overlays), canvas mount
styles.css            UI system (neon geometry, no external fonts/images)
src/main.ts           app state machine: title → lobby → game; UI wiring; gamepad menu nav
.github/workflows/pages.yml  build dist and deploy the main-branch alpha to GitHub Pages
src/game/tuning/      gameplay tuning JSON: player, programs, threats, campaign, world
src/game/config.ts    typed facade over tuning JSON + engine limits and palette; import from here, never JSON
src/game/programs.ts  roster: program ids, names, hues, core glyphs, signature skills
src/game/campaign.ts  first playable campaign node: level identity, arena blockout, sector link
src/game/road.ts      campaign route plate for the between-level transition (parked, not mounted)
src/game/arenas.ts    nine arena layouts (MAINFRAME multi-district, DISK PLATTER round), spawns, previews
src/game/nav.ts       per-arena 20u navigation grid + reusable A* workspace for bots
src/game/bot.ts       local bot brains: tiers, styles, same InputFrame as a human
src/game/powerups.ts  local pickup ids, labels, colors, durations and weighted roll
src/game/gauntletRecords.ts local top-run model, ranking and storage
src/game/saves.ts     story-mode save slots: slot format, storage and per-level save
src/game/sectors.ts   five-sector campaign graph, node/link definitions and schematic renderer
src/game/types.ts     shared interfaces and network packet shapes
src/game/identity.ts  palette, glyph drawing, callsigns
src/game/rng.ts       seeded RNG for deterministic tests/bench
src/game/input.ts     keyboard, mouse buttons, gamepad; per-player InputFrame
src/game/audio.ts     Web Audio synthesis (no files) + MIDI-note lofi-house loop
src/game/world.ts     authoritative simulation (players, projectiles, rounds, drone, gauntlet threats)
src/game/camera.ts    camera rig director: priority, blend, hold; no per-frame allocation
src/game/render.ts    canvas renderer, camera framing/grouping, HUD, in-world FX
src/game/particles.ts pooled particle system
src/net/net.ts        PeerJS host/guest sessions, snapshot interpolation
src/ui/dom.ts         small DOM helpers / screen manager
src/ui/touch.ts       DOM touch stick and action buttons; ordinary InputFrame bits only
scripts/gen-icons.mjs PWA icon generator (pure Node, zlib PNG encoder, no deps)
scripts/bench.ts      headless simulation benchmark (ms per 60 Hz tick)
CAMPAIGN.md           campaign topology, map handoff and open rules decisions
GAME_GUIDE.md         player-facing modes, controls, kits, arenas and the QA checklist
public/               manifest, generated icons, service worker
```

### Simulation model

- Fixed step **1/60 s**, accumulator in `main.ts`; render interpolation via `prevX/prevY` and alpha.
- Playfield: `1280×720` virtual space; playable rect inset by `ARENA_MARGIN`.
- Entities are preallocated and reused. Projectiles and particles use `active` flags and compaction-free
  iteration. **No allocation in `step()` or `draw()`** (no object/array literals, closures, or string
  concatenation per frame). Numbers only.
- Players live in `world.players` with a stable slot index. Slot 0 is the host.
- Avatars (players, local bots, thralls and online guests) share `PLAYER.radius` for both collision and
  rendering. The hull, core glyph, heading arrow, lock reticle, readiness-column offset and bot nav
  clearance all derive from it; enemy and drill radii are separate. Do not add a second visual-only
  avatar scale. The active arena's spawns must stay clear at this radius.
- The active `ArenaDef` supplies pillars, optional floor gaps, traversal plates and ordered spawn
  points. Any player count spreads evenly around that arena's spawn ring; the training drone uses the
  opposite spawn. Bodies collide with `arenaSolids()`; projectile, laser and firewall collision uses
  `pillars` so shots cross a trench. An arena with `walls: 'open'` treats its bounds as a lip instead of a
  wall: the clamp is skipped, a crossed body falls (`SRC.VOID`), shots die at the edge instead of bouncing,
  and pushed threats are culled as clears. See D19.
- Pads and lifts are per-player travel state, resolved after motion. They need a slow body on the plate
  for the dwell window, reject attacks and approaches, and lock input for the ride. A pad swaps position
  at the ride midpoint so the renderer can play unload/reload; a lift moves immediately and is hidden by
  its transition. Guest prediction does not receive travel fields yet, so an online guest sees the host's
  position snap after a pad or lift.
- A projectile whose muzzle point would start inside arena geometry is refused: no bolt, no energy
  spent. Without this rule a point-blank shot can ricochet directly back into the shooter's body.
- Projectiles store `ownerSlot`, `deflects`, `bounces`, `armed`. A bolt cannot hit the player who last
  launched or deflected it until it has bounced off a wall (`armed` resets).
- Bolts: speed ×1.4 per deflect, damage = 1 + deflects, short 0.45 s life (~390 units), one bank per
  life (deflect restores the budget), fired as a **five-shot stream** with a 0.2 s recharge and low
  per-shot energy cost. Projectile types are `0` bolt, `1` bug mine, `2` bug trap, `3` hostile shot,
  `4` hostile homing missile. The old candle is gone; the charged beam is the heavy commitment.
- Held guard reflects every projectile in the front half-plane inside `PLAYER.guardReach`. It runs before
  swing resolution, spends guard time per catch, and sets `PF.GUARD` so guests can draw it.
- Powerups spawn only in training/gauntlet and are collected by any live player. Definitions are data in
  `powerups.ts`; the world never hard-codes a pickup label or color.
- Laser damage is tested against the full worm chain, not just the head, and against `beamReach`, so a
  wall or compactor plate clips the damage exactly where it clips the drawn shaft. A guarding rival in
  the corridor reflects the beam (D22). Wall shields absorb projectiles from other players; ghost ignores
  contact/projectile damage and ends on any attack.
- Hit detection is substepped (max 6 units per substep) so 2800 u/s bolts cannot tunnel.
- Program kits are data in `programs.ts` plus branches in `World`. Probe keeps the five-shot burst,
  charged piercing beam (0.45 s, release-cancelable) and persistent trap mine; Wedge fires a three-shot string, dashes with a damaging
  bracket, plows a charge with side shoves, and plants a static wall behind himself; Fisher throws a piercing spear,
  draws a freeform net that catches bodies and reflects shots, and drops a lure beacon that pulls aggro. Do not fork the
  whole world per program; branch the four kit jobs and keep collisions, energy, cooldowns and hit rules
  shared. The solo player's pick owns slot 0; local bots take the unused programs through `botPrograms`,
  while online opponents stay Probe because the snapshot does not carry programs yet. Online matches
  still draw and color by slot identity.
- Fisher's net is a polyline sampled while he moves (`FISHER.netPoints`, `netPointSpacing`), smoothed once
  on deploy with a corner-preserving pass (`netCornerCos`), then used for both collision and rendering.
  It reflects shots off the nearest strand and does **no damage**: bodies it touches are held in place
  (`Player.netPinT`, refreshed every tick) until it expires, and hostiles and the training drone are
  pinned the same way. A dash
  or Wedge's plow phases through because those moves already pass geometry. Do not turn it back into a
  straight segment or a knock-back shove; the drawn shape is the hitbox.
- Wedge's bracket and plow are displacement first (`WEDGE.bashKnockback`, `chargeKnockback`). The slide is
  the shared knock velocity easing out under `PLAYER.knockDrag`, roughly 355 units for a bracket and 378
  for a plow; the grey square dust is render-side and derived from motion, not a new packet field.
- Round: last player alive scores a round win. First to 3 round wins takes the match. Simultaneous death
  (or timeout) = draw, no score. Round timer 90 s; timeout = draw.
- Local bot matches run `BotBrain` outside the world: each brain reads public player/projectile state and
  writes an `InputFrame`. It never calls world mutation methods. Digital reaction is 55 ms with perfect
  lead; lower tiers add reaction delay and aim error. Cover pathing is a 20u grid A* with line-of-sight
  shortcuts, re-planned on a 0.55 s timer or when the target moves. Eight bots plus simulation and
  pathfinding measured 0.02–0.03 ms/tick avg (p99 under 0.15 ms) across repeat runs.
- Gauntlet threat simulation is local-only and never enters `Snapshot`. Worms, viruses, firewalls and the
  local thrall are preallocated pools; the thrall drives an `InputFrame` from a small in-world controller
  instead of direct position mutation. Firewall damage and the drawn beam both use the pillar
  line-of-sight test, so cover shown on screen is cover that works.

### Renderer

- Single canvas, DPR-aware, letterboxed to 16:9, integer-ish scale. Every arena is wider than the view,
  so the camera pans and follows the local avatar.
- Camera framing: the local avatar is the anchor. Other live players, the training drone, worms, viruses,
  sentries and cascading-error blocks inside `CAMERA.focusRange` pull the frame toward the group by a
  distance-weighted mean offset, capped at `CAMERA.maxBias`. A body across the arena does not count, and
  a brawl on every side cancels out. The anchor is then clamped to the middle band of the view
  (`CAMERA.edgeMargin`), unless the arena bound already pins the camera. Dynamic zoom pulls back when the
  group is spread (`CAMERA.zoomMin`/`zoomMax`). Up to four local panes each get their own camera, zoom and
  HUD through `setLocalSlots`; see D18. All numbers live in `tuning/world.json` under `CAMERA`; do not make the view
  follow the group centroid without the anchor clamp.
- Dark background, grid, arena frame, corner brackets, and the active arena's pillars.
- Each arena supplies an accent and a floor signature (cross, square, rings, chevrons). The title
  picker draws the same geometry into small preview canvases; no separate art path.
- All glow is multi-pass stroke + `globalCompositeOperation = 'lighter'`. **Never** use `shadowBlur`.
- Trails are drawn from a small ring buffer per projectile. Gradients are built on resize only.
- HUD is canvas-drawn. Health is the avatar's rotating three-segment outer silhouette; energy is the
  inner arc. Dash charges, the skill mark and the power-attack mark sit in one compact readiness dock per
  local player: a dark panel, three large icon cells, cooldown rings, no text. A solo local keeps it
  top-left; split view puts one in each screen corner. There are no operator chips,
  name plates, side bars or per-player corner bars. Health, energy, heading and readiness belong to the
  local players only. Round/timer/score pips live in the bottom strip. Permanent
  in-match text is suppressed; only short wave banners and the DOM pause/round/match overlays carry
  words. Label strings are cached. Blueprint canvases size their backing store from the CSS box at device pixel
ratio (`fitCanvas` in `src/ui/dom.ts`) and draw in a fixed design space, so map labels stay at the console
text scale instead of being baked into a small bitmap.
- Cover is a solid object: bright panel fill, inset panel, hard rim and top highlight. It must not read as
  floor texture. A trench is the opposite: near-black fill with a lit lip, so it reads as open space. The
  bridge is a deck with rails and moving traffic ticks. Pads are ringed plates with a mate arrow; lifts
  are circular pads with chevrons pointing toward the linked deck.
- Pad transit draws the avatar in its own layer order (glyph, core, hull) instead of hiding it; the hull
  is first to leave and last to return. A scan ring and slice line sell the transfer. The lift uses the
  screen-space shrink-and-fade transition. Both are render-only and must not change hitboxes or timing.
- The minimap is optional, shared by the whole screen, and reuses the same arena geometry. A solo view
keeps it lower-left; a split view or more than one local player puts it top-centre, between the panes.
- Dead players leave no field marker. Do not draw a corpse ring, X or ghost body; the death burst and the
  respawn timer carry the state, and a leftover marker reads as another interactable.
- DOM is only for menus, lobby, toasts, and round/match overlays. The title and settings screens keep
  the CRT scanline treatment; the arena does not draw scanlines.
- Enemy pools draw an assembly phase on spawn (scale/rotation/reveal) and emit size-scaled triangle
  shards on death. These are render-side, allocation-free, and must not change hitboxes.

### Audio

- One lazy `AudioContext`, unlocked on first gesture. Master gain + compressor. Master volume, mute,
  soundtrack, sound-effects, and menu-sound levels persist in `localStorage` and are exposed in the
  Audio settings tab.
- Digital timbres: square/triangle/saw oscillators with fast envelopes, short noise bursts through
  band/low-pass filters. Button click, shoot, swing, deflect chirp, wall bounce, explode, hit, dash,
  round arpeggio, victory motif. The music bed is a four-bar, 82 BPM lofi-house loop: seventh chords and
  bass encoded as MIDI note numbers, soft four-on-the-floor kick, swung hats, claps, and a low vinyl
  crackle layer. The music bus is low-passed at 7 kHz for warmth; combat cues stay sharp. `M` mutes the whole
  mix.  Nothing loaded from disk.
- Mix levels are part of the sound design, not free knobs. The music bus sits at `MUSIC_BUS_LEVEL` (0.5) and
  every music voice gain is written against it; the chord and bass voices use a sustained `pad()` envelope
  (quick attack, held level, short tail) instead of `tone()`'s full-length exponential decay, because the
  bed has to keep body in the 250 Hz–2 kHz band that laptop speakers actually reproduce. Target: the loop
  measures roughly −33 dBFS RMS with −18 dBFS peaks, about 8–12 dB under a combat cue peak (a bolt is
  ≈ −22 dBFS). The match loop starts with a session; the menu bed is the same changes at 62 BPM with no
  drums, one held pad per bar, a soft bell, and `MENU_BUS_TRIM` (0.6) on the same bus, so leaving the arena
  drops back to it. One scheduler owns both (`startMusic(mode)` restarts on a mode change) and `setScreen`
  switches between them; do not run two timers or two buses. Measure through the engine's master tap before
  changing these numbers; the previous 0.24 bus left the chords near −59 dBFS and silent in practice.

---

## 4. Controls

| Action | Gamepad (preferred) | Keyboard/mouse |
| --- | --- | --- |
| Move + face | Left stick | `WASD` / arrows |
| Melee attack / guard | `B` | Left mouse / `J` |
| Ranged attack | `X` | Right mouse / `K` |
| Power attack (hold) / skill (tap) | `Y` | `E` / `L` / middle mouse |
| Lock target | `LT` | `Q` |
| Cycle lock target (hold `LT`) | `RB` / right stick left-right | `R` / `F` (hold `Q`) |
| Dash / charged dash | `A` / `L3` | `Shift` / `Space` |
| Menu confirm | `A` / `Start` | `Enter` / focused button + `Space` |
| Menu move | D-pad / left stick | Arrows |
| Menu back | `B` / `View` | `Escape` |
| Open in-game menu | `Start` | `Escape` |
| Toggle canvas UI | `View` / `Select` | — |
| Mute | — | `M` |
| Perf HUD | — | `F3` |

`B` is the deflect button in-game, so only `Start` opens the in-game menu while playing. `View`/`Select`
backs out of menus and toggles the canvas UI during play for the session; it does not rewrite `GAME UI`.
`B` closes an open overlay (menu back). Settings are a top-level title option; the gamepad navigates the
four tabs with the d-pad/stick and confirms with `A`. Gameplay actions are edge-triggered and buffered: guest inputs
include a `pressed` mask accumulated since the previous send so taps are never lost between 60 Hz packets.
Lock cycling is an edge action (`LOCK_NEXT` / `LOCK_PREV`); holding `LT` keeps the lock, and each
bumper press or right-stick flick moves one target around the player in angle order. Cycling does not
restart the acquisition delay.

Arena and bot setup live on the title screen and flow in stages: `SINGLE PLAYER` → program (training or
gauntlet) → arena card with previews → bot count/tier for training, or run type for gauntlet. The host can
cycle the arena in the lobby; the choice reaches guests in `START`.

---

## 5. Network protocol (v1)

PeerJS binary serialization, arrays of numbers. Payloads are versioned by the peer id prefix.

```
guest → host  INPUT   [type=0, seq, heldMask, pressedMask, moveX, moveY]
host → guest  SNAPSHOT[type=1, seq, phase, phaseTimer, round, roundTimer,
                       roundWinner, matchWinner,
                       players[ slot, flags, x, y, facing, hp, energy, score, swingPct,
                                lockId, bugKind, bugCd, laserCd ],
                       projectiles[ serial, type, owner, x, y, vx, vy, radius,
                                    deflects, fuse, grace, armed ],
                       events[ kind, slot, x, y, power, dirX, dirY ]]
host → guest  LOBBY   [type=2, code, canStart, hostSlot, players[ slot, name, ready, connected ], arenaId]
guest → host  LOBBY   [type=3, name, ready]
host → guest  START   [type=4, arenaId]
host → guest  MATCH   [type=5, slot]  // identity assignment on join
```

The arena id is sent in both `LOBBY` and `START`; it is an `ARENAS` index. Guests use it for rendering and
local movement prediction. Snapshots carry no geometry. Do not reorder these fields without changing
`packet` / `parseSnapshot` together. Positions are rounded to 0.1 on send; facing and fuse/grace are
rounded to 0.001/0.01. Snapshots carry no fx seed; particles and shake use host event data and local
particle state.

Interpolation: guests hold two snapshots with receive times and render 65 ms in the past. The local
player is predicted: guest runs the same movement/dash code locally, then eases toward the authoritative
position (snap beyond 80 units). HP/energy always come from the snapshot.

Host loss: guests return to the title with a `[DEFLECT-NET]` warning toast. Guest loss: host frees the
slot after a 6 s grace and marks the player as disconnected; if a round is live, their avatar is removed.

---

## 6. Tuning & feel rules

- Every gameplay number lives in `src/game/tuning/*.json` and is re-exported from `src/game/config.ts`.
  Systems import from `config.ts`, never from JSON. No magic numbers in `world.ts`.
- A feel change must state the old value, new value, and why in `HISTORY.md`.
- Headless harnesses are the first pass, not the final word. When results are surprising, inconsistent
  between samples, or depend on readability, camera framing, hit feedback, audio or control feel, run a
  headed `npm run dev` session and play the exact scenario. Headed/visual evidence may qualify or overturn
  a numeric result; record both.
- **Health is not a balance knob.** Do not change player or enemy health to improve balance without
  explicit user approval. Tune damage, speed, cadence, cooldowns, telegraphs, movement and attack windows.
- Keep the single-stick trade-off intact: if a change lets a player face one way and attack another,
  it is out of scope (that is twin-stick) unless the designer explicitly asks for it.
- Visual identity: basic shapes only. No bitmaps besides the PWA icon. No sprite sheets. Animation comes
  from rotation, scale, dash afterimages, trail length, color shifts, particles, and shader-free additive
  layering.
- New colors must come from `identity.ts` so player distinctness stays controlled.

---

## 7. Deployment

The alpha is hosted from `main` with GitHub Actions: `.github/workflows/pages.yml` runs `npm ci`,
`npm run build`, and deploys `dist/` through the Pages artifact action. The repository Pages source must
be **GitHub Actions**; serving the raw branch would expose unbundled TypeScript instead of the game. The
play URL is <https://spuds0588.github.io/DEFLECT/>.

### D33 — COPY_PASTA.EXE: file chain, bot copy, redaction super (built 2026-11-01)

`COPY_PASTA.EXE` is the roster's **duplicate** program (id 11, `bugKind` 14). Identity: `PROGRAM_COLORS.copy`
(`#ffe95c`), a hull of three upright file icons (one per health segment) orbiting at 0.8r, and a vector
two-square copy stamp (`drawCopyMark`). The file hull's inner edge is 0.61r, so it clears the full core
disc; the files stay upright while the ring turns. Do not turn the hull into a polygon: the three documents
are the health readout, and the copy stamp is the only other copy symbol.

- **Ranged** (type 16): one file, 1 damage, 620 speed, 1.15 s life. On a body it deals its hit, then tears
  into `splitCount` (2) smaller files from a point 26 units outside the struck body. Children are
  `variant` 1, do 1 damage, fly at 0.72x speed for 0.55 s, and never split again. The spawn offset is a
  gameplay constant: at 6 units the children spawned inside the victim and re-hit it, which made every
  file a guaranteed 3-damage burst instead of a chain. Do not remove the offset or the variant cap. File
  damage is a normal hit; the chain does not bypass cover, guards or the owner's own body.
- **Skill**: one copy body on the last slot (`MAX_PLAYERS - 1`), `cloneLife` 8 s, 3 health, excluded from
  `activeCount`/`aliveCount`, round survival and `beginRound` spawns. It writes the same `InputFrame` a
  human or bot does and obeys one-stick facing, swing locks, dash charges and energy. It hunts the nearest
  threats in gauntlet mode and the nearest other program in bot matches, trails its owner when there is
  nothing to fight, and presses only ranged, melee and dash (no nested copy and no heavy). A refused cast
  hands the skill energy back. `clearCopyClones()` runs on every round start; a copy never respawns.
- **Dash afterimage**: every dash by a real Copy Pasta body leaves an inert copy at the takeoff point.
  It lives `dashDecoyLife` (1.5 s), has `dashDecoyHp` (1) health, writes an empty input frame, and never
  moves, attacks or spends energy. It uses a free body slot below the skill copy's reserved last slot, so
  a fighting copy and an afterimage can exist together. Sentries, worms, viruses, the training drone and
  calibration subjects pick the nearest valid body, so the afterimage can pull their attention and absorb
  one hit. It is excluded from player target lock, round counts and gauntlet kill credit; its death must
  not drop a pickup. Bots may target it. `copyDecoy` is local-only and absent from `Snapshot`.
- **Power**: a 280-unit redaction ring at the caster. Every enemy with line of sight gets a growing stack
  of red file icons over 1.6 s (1 to 6 icons), then 2 damage to players or 3 to threats. Cover blocks the
  cast; once marked, the stack follows the body and detonates even if it steps behind cover. Marks are a
  local world pool (`World.copyMarks`) and are never in `Snapshot`; `RenderState.copyMarks` draws them.
- Bots cast the copy at 120–380 units and the generic heavy hold builds the redaction. Their engagement
  range uses the file's 620/1.15 s flight. All numbers live in `tuning/programs.json` under `COPYPASTA`;
  the skill cooldown is the 15th entry in `player.json` `BUG.cooldown`.

### D34 — AIM_BOT.EXE: scope, rail round, sight clip, six-target volley (built 2026-11-01)

`AIM_BOT.EXE` is the roster's **sniper** (id 12, `bugKind` 15). Identity: `PROGRAM_COLORS.aimbot`
(`#ff3355`), an outer scope circle split into three thick brackets (one health segment each, each with an
inward tick), and a vector twin-ring reticle at the core (`drawAimBotMark`). The bracket ring sits at
0.96r and its tick reaches only 0.72r, so the hull never crosses the core disc. The mark is direction
neutral; do not replace it with a pointing arrow.

- **Ranged** (type 17): one rail round, `shotDamage` 5, `shotSpeed` 2000, `shotRadius` 5,
  `shotTtl` 1.6 s, `attackCooldown` 2.8 s, `shotCost` 18. It does not bounce and dies on the first body
  or solid surface. The 1.6 s life covers 3200 units of travel, enough for the sight line in these arenas.
  Speed 2000 restores travel time: at 3200 the round was effectively hitscan and a
  perfect-aim bot never missed, which measured 24-0 across the roster. Five damage still deletes a
  three-segment program but leaves a six-segment hull on one segment. The projectile is
  drawn as a dark bullet with a white tip and a long fading red speed tail, not as a bolt. It is a normal
  player projectile for guard/deflect purposes; do not add it to the heavy splash lists.
- **Lock and camera**: `playerLockRange` raises Aim Bot's lock to `AIMBOT.lockRange` 2400; every other
  program stays on `PLAYER.lockRange`. `lockTX/lockTY` expose the target for the renderer. A local Aim
  Bot's camera floor is `CAMERA_ZOOM * AIMBOT.cameraZoom` (0.4), and `addAimLockFocus` pulls toward the
  lock without the normal `CAMERA.focusRange` cap. Do not route that pull through `addCameraFocus`; a
  2400-unit target is deliberately outside the normal group pull and would fall off screen.
- **Skill**: `sightTime` 7 s of visible dashed sight plus `clipSize` 3. Clip shots fire at
  `clipInterval` 0.16 s, skip the 2.8 s reload, and still pay 18 energy each. The clip expires when the
  sight does; it is not a permanent second magazine.
- **Power**: builds up to six targets inside a 0.44 rad half-angle forward cone within 2400 units and
  line of sight (`players`, worms, viruses, the training drone, sentries and cascading errors). Each gets
  a red crosshair for `volleyTelegraph` 0.65 s plus a 0.06 s stagger, then a 12-damage shot
  (`volleyKnockback` 1700) with no projectile entity. Cover is checked again when each mark fires, so a
  target that steps behind a block is spared. Marks live in the local `World.aimMarks` pool and
  `RenderState.aimMarks`; nothing enters `Snapshot`.
- **Melee**: the rail has no crowd clear, so the knife is the sniper's answer. `AIMBOT.meleeReachMult`
  1.5, `meleeArcMult` 1.22 and `meleeKnockMult` 1.75 set the per-body caps `Player.meleeReachMult`,
  `meleeHalfAngle` and `meleeKnock` at program bind, like Pinball's guard reach: 78 reflect / 108 body
  reach, a 219.6 degree sweep and 980 shove. Those caps own the projectile catch in `resolveSwing` and
  the body cone in `resolveSwingContact`; bot melee spacing reads the same reach. The renderer draws the
  sweep as a bowie blade (grip, cross guard, clipped spine, curved belly, fuller) instead of the spiked
  lash. Do not give the knife a second hitbox or a damage bump: the trade is area and shove, not more
  damage.
- Bots use the rail speed and a 2.4x engagement range, and the generic heavy hold builds the volley.
  The program is local-only like the rest of the roster; online still runs Probe.

### D35 — SPACE CADET: pinball cabinet furniture and feed (built 2026-11-01)

`SPACE CADET` (arena id 10) is a tall cabinet. `ArenaDef.bumpers` owns round furniture:
`kind: 0` posts reflect shots and shove bodies (`SPACE_CADET.postPush`), `kind: 1` kickers launch bodies
(`bumperLaunch`) and speed shots up (`bumperShotGain`, capped by `shotSpeedMax`). Body collision is shared by
players, worms, viruses and sentries through `World.bumpBody`; shots use `bounceBumpers`. Committed shapes
(including Aim Bot type 17) die on a bumper rather than bounce. The bottom drain is a normal `voids` rect,
so the existing fall path owns the kill. The right-side `ArenaPipeDef` uses `feed: 'pinball'`: a four-beat
file, hostile type-14 ball, virus, sentry loop. The ball is ownerless, bounces off walls/pillars/bumpers and
can hurt any body. This is local-only content; the arena carries pipes, so hosted rooms skip it. All feel
values live in `world.json` under `SPACE_CADET`.

### D36 — KEYPAD: moving keycaps as an online-safe arena hazard (built 2026-11-01)

`KEYPAD` (arena id 11) is a ten-key phone pad that **is** the arena. Bounds equal the housing
edge-to-edge: there is no exterior floor, side room or spawn gutter. The eight spawns stand on the
housing's own bezel, clear of every cap. The layout in `ArenaDef.keypad` is a 3×4 grid: digits 1–9 in
the top three rows and a centered 0 on the bottom. The caps are deliberately enormous (680×528; one key
fills most of the camera view at normal zoom) so they read as industrial keys under a player-sized
body. The ten caps cycle from a recessed socket to a warning lift, a slow downward slam, solid cover, and
a rise. Every key has a phase offset from `KEYPAD.offsetStep`, so the pad is a rolling pattern instead of
ten caps moving together. Timing, crush damage and offset live in `tuning/world.json` under `KEYPAD`.
Do not add an exterior lane back: if a spawn needs clearance, move it onto the bezel or adjust the
housing, not the bounds.

- A cap is harmless while up or warning. On the first frame of `SLAM`, every body whose circle overlaps
the cap is crushed. Players take `KEYPAD.playerDamage` (3 segments); training drones, worms, viruses,
sentries and error blocks take `KEYPAD.threatDamage` (99), which deletes them through the normal damage
paths. This is deliberately lethal to threats, not a second combat system.
- `SLAM`, `DOWN` and `RISE` footprints are solid cover. They block players, local threats and projectiles;
the player is pushed out after the shared motion step, including mid-dash. A down cap also blocks beams
and line-of-sight reads, so it is true cover while it is on the floor.
- Key timing is **online-safe**: `Snapshot` carries the shared `keypadT` clock and every peer derives the
ten states with `keypadKeyState()`. The host still owns the crush; a guest mirrors HP and uses the solid
caps only for prediction. `onlineArenaIndex` no longer skips a keypad arena. Do not add per-key state rows
to the snapshot; the clock is the contract (D40).
- Bots steer around warning and down caps through the same furniture-avoidance path as bumpers. The
keypad must not add per-tick pathfinding or a second grid; the dynamic caps are not baked into `nav.ts`.
- The renderer draws the socket, warning bars, solid cap, digit and minimap footprint from the same
`World.keypadStates` array. It also reads `keypadKeyPhase()` to interpolate the cap's travel through the
slam and rise; do not snap the drawing back to a single lifted/down pose. Keep the digit readable in
every state: the phone-pad silhouette is the map's identity, not decoration.

### D37 — DOCUMENT SCANNER: page churn and a sweeping read line (built 2026-11-01)

`DOCUMENT SCANNER` (arena id 12) is a walled room with a large glass platen at its center. The page and
its feed slot live in `ArenaDef.scanner`: a 1254×758 bed and a short stack of document labels. The
timings and damage live in `SCANNER` under `tuning/world.json`. The cycle is **load → warn → down → up →
unload**: a sheet rises from the slot, a horizontal read line sweeps from the top of the bed to the
bottom, snaps back up, then the sheet drops away and the next one rises. The return is intentionally
much faster than the read (3.2 s down, 0.6 s up) so players have to keep hopping the line instead of
walking behind it once and settling.

- The line is active on the down and up passes, never during load, warning or unload. It is a
firewall-class hazard: `SCANNER.damage` (1 segment) and `SCANNER.knockback` for players,
`SCANNER.enemyDamage` (3) for worms, viruses, sentries and error blocks. A dash is airborne and clears
the line; the scanner must not damage a body with `dashT > 0` or a phased cloak.
- Damage is **once per pass per body**, tracked with the same bitmask pattern as a beam pass. Do not
replace it with a per-tick tick timer: a body standing in the line would eat several segments on one
sweep, which breaks the hop rhythm and makes the map read as unfair.
- The page labels, redaction bars and review stamps are cosmetic storytelling. They are not campaign
flags, objectives or a second narrative system, and they must not gate spawns or rewards. The current
labels imply an internal review with missing material and a cold-storage paper trail; keep that in the
renderer/data rather than adding `World` story state.
- `Snapshot` carries `scannerT` and `scannerPage`; `scannerPhaseAt()` and `scannerLaserY()` derive the
presentation on every peer. The host still resolves the once-per-pass damage and hit masks locally.
`onlineArenaIndex` may keep a scanner arena; never add hit masks or per-body pass bits to the snapshot.
- `scannerCycle()`, `scannerPhaseAt()` and `scannerLaserY()` in `arenas.ts` are the single source of
truth for the renderer and the world. Keep the line clipped to the bed and the page slide in the
renderer; no scanner state belongs in the nav grid or bot targeting.

### D38 — BROWSER: forum pages and a click cursor (built 2026-11-01)

`BROWSER` (arena id 13) is a browser window whose site is a forum thread. `ArenaDef.browser` supplies the
chrome, page rectangle, tabs, scrollbar and a `pages` list. Each page has a title, URL, solid forum cards
and a navigation link. The **active page's cards are real cover**; the chrome and scrollbar are the only
static `pillars`. The page index and cycle clock travel in `Snapshot`; `browserCursorAt()` and
`browserClickAt()` derive the cursor, phase and click flash on both sides. The host still owns click
damage. The map is online-safe under D40.

- The cursor idles over the page, seeks the current link, hovers, then **click slams** for one segment and a
  shove in `BROWSER.clickRadius`. A dash or cloak clears the slam. Threat families take
  `BROWSER.enemyDamage`. The slam lands at the link, then the browser advances to the next forum page; the
  crosshair is a navigation action, not a second player attack.
- Page cards are dynamic cover for players, threats, projectiles, bombs, beams and blast line of sight.
  They are swapped by `World` from the page data. Do not add the cards to the static `pillars` list or to the
  nav grid: the grid cannot follow a page swap. Bots steer around the active card rects with the near-field
  probe, while movement uses the same slide as other furniture.
- The four pages are a forum index, a thread, a deeper post and a locked/archived page. Their card layouts
  differ on purpose, so navigating changes the fight's cover. Labels and URLs are browser flavor, not
  objectives. The active tab is visual; no tab closes during play.
- `browserCycle()` and `browserPhaseAt()` in `arenas.ts` are the shared timing source. `World` owns the page
  cursor and click; the renderer draws the page, link and pointer from those public fields. Keep the page
  layout aligned with the active `elements` list: a card moved only in the renderer is a collision bug.
- The title-card preview shows the first page; the minimap shows the active page's cards. `Snapshot`
  carries `browserT` and `browserPage`, and the guest rebuilds the active page's cards from the arena
  record. Do not send the card list or cursor coordinates; derive both. Host owns the click hit (D40).

### D39 — Series are fixed-length, random-by-default map runs (built 2026-11-01)

`VS BOTS` and online versus may run a **series**: 1, 3 or 5 games. A game is unchanged — the normal
first-to-3-round match (`ROUND.winsNeeded`); the series counts game wins and can end tied with three or
more players. Default `GAMES: 1`. Training, gauntlet, campaign and infection never use a series.

`MAPS: RANDOM` is the default. It draws from the same eligibility predicate as `onlineArenaIndex()` for
hosted rooms and all `ARENAS` locally, and never repeats the immediately previous map while another
candidate exists. `MAPS: FIXED` is the custom choice and uses the arena selected in setup or the lobby for
every game. Do not add per-game veto/vote UI: the host owns the rule online and guests follow `START`.

`src/game/series.ts` owns lengths, normalization, map picking and series winner/tie calculation. Local
bookkeeping lives in `main.ts`; online `LobbyState` carries `series` and `mapRule`, and `START` carries
series/game/mapRule. The host advances with `HostNet.startNextMatch()` without rebuilding the room; the
guest waits for the next `START`. Do not put series state in `Snapshot`: it is match metadata, not per-tick
simulation. A fixed map must remain an eligible arena for the room.

Pattern source: Smash Ultimate stage rules separate a random/curated stage choice from the fight, and
Mario Kart VS races separate race count from course selection:
<https://www.ign.com/wikis/super-smash-bros-ultimate/Stages_and_Stage_Options>,
<https://game8.co/games/Mario-Kart-World/archives/527834>. Halo veto/vote is deliberately not copied; it
adds matchmaking ceremony a private group does not need.

### D40 — Arena hazard clocks are snapshot data (built 2026-11-01)

The compactor, keypad, scanner, browser, USB, SWIPE and SATELLITE arenas are **online-safe**. `Snapshot`
index 13 carries one compact hazard block, or `null` on a quiet floor:

`[pusherT, keypadT, scannerT, scannerPage, browserT, browserPage, usbT, swipeT, swipePopupT, props,
satelliteT, satelliteState, satelliteThrusterT, satelliteReentryT, satelliteHeatY, satelliteMeteors]`

`props` is `[index, kind, x, y, w, h, hp, hitFlash, dropT, capacitor]` for each live prop; the last field
is additive and older hosts omit it. `satelliteMeteors` holds `[index, x, y, t, hit]` rows only while live.
The clocks and compact lists are enough because every visible hazard is deterministic from the arena record:
`pusherPhaseAt()`, `keypadKeyState()`, `scannerPhaseAt()`/`scannerLaserY()`, `browserPhaseAt()`/
`browserCursorAt()` and `browserClickAt()` are the shared derivations. Do not send per-key states, cursor
coordinates, page cards or hit masks; they can drift or bloat the packet.

- The **host still owns every hazard hit**: compactor carry, keypad crush, scanner pass, browser click,
  prop damage and prop physics all resolve only in `World`. A guest mirrors HP from the same player rows
  and never runs hazard damage or prop physics. `NetView` is presentation plus prediction only.
- Guest prediction adds dynamic cover it can see: solid key caps and the active forum page's cards.
  Static `arenaSolids()` remains shared. The compactor is a **carry clamp after motion**, not a solid
  rect, because resolving the descending plate as a rect would push a body above it out through the top
  edge. This is feel correction, not authority; the host's position wins on the next snapshot. Props are
  not body cover and never enter the predictor.
- `NETWORK SWITCH` and `SPACE CADET` stay local. Their `pipes` spawn hostile files, sentries and viruses,
  and `NETWORK` carries a firewall switch and sweep; none of that threat state is in `Snapshot` (D9).
  `onlineArenaIndex` excludes `pipes`/`firewallSwitch`, not the clocks above. Do not add threat rows to the
  snapshot just to open those two maps.
- `DISK PLATTER` and the wall emitters are not in this block. Hosted matches keep the platter's static
  holes, parked arm and unbuilt emitters because their moving voids/beams would need dynamic prediction
  and a separate protocol decision (D27, D30). Do not treat the clocks above as permission to add
  every fixture to the packet.
- Satellite fields are appended only on a satellite arena, so every older hazard shape stays
  byte-identical. Measured v0.1.112: a full SATELLITE block with seven live meteors and three capacitor
  rows packed to **192 B**; clock-only maps still packed to **16 B**. At 30 Hz the satellite block is
  +5.8 KB/s per guest, or +40.3 KB/s of host upload with seven guests (about 7% of the measured 0.59 MiB/s
  host baseline at 8P/48 projectiles). A quiet arena pays one `null`.

### D41 — QUARANTINE is the connected tutorial level (built 2026-11-01)

`BUILD ROOT` now opens on `QUARANTINE` (arena id 14), one local-only arena with four authored rooms and
three bridge crossings: the circular **INTAKE** office, the square **HOLDING** office with a three-cell
block, the **MAINBOARD** rectangle, and the larger **ROUTER** room ending at a **NETWORK PORT**. This is
one continuous level, not four campaign nodes; the camera and lesson follow the player across the bridges
without a separate transition system.

- `ArenaDef.rooms` (shape, theme, label, sub) and `ArenaDef.bridges` are presentation data.
  `traverse.chasms` owns the body blockers: the floor between rooms is split above and below each deck,
  so the bridge is the only crossing for bodies; shots and beams still cross the gap. Do not add room
  collision to `World` or the guest predictor.
- The room renderer (`drawTutorialRooms`) paints the circle/rect plates, intake carpet/lamp cones, holding
  cell block and bars, mainboard traces/chip pads, router port banks/LEDs, bridge rails/data thread, and the
  final port. `ROOM_THEME_COLORS` is shared with the picker preview. No `shadowBlur`, filters or per-frame
  gradients.
- `BUILD ROOT` starts at spawn 6 in the intake circle. The Warden's move/dash/fire/lock/cycle/melee/
  reflect lesson runs there. `spawnCalibrationShapes` places the six dormant subjects in two columns in
  the `holding` room's lower half when the arena has rooms, leaving the centre lane for the bridge entry.
  The first crossing is the reveal. Keep the anchor generic; do not hard-code an arena id.
- The holding room owns the scripted set piece: three civilian monitors (TICKET, PATCH, CACHE), three cells,
  and script_kitty in the middle cell. On wake the civilians are hidden and a short red/orange burst is
  emitted at each monitor anchor; any carried files drop. They remain decorative; no `Player` bodies, hits,
  health, AI or snapshot rows are added for them. The kitty is a render-only cameo in the cell block, not
  an `ArenaDef.regular`.
- The holding cell block is solid body collision while it is sealed; `holdingCellLayout` owns the shared
  geometry. The wave-2 worm and viruses are created with the level and wait behind the bars with `held`
  set: AI, damage and target lock are skipped, and the caged silhouettes are their presentation. No
  replacement body is created on release.
- `CALIBRATION_SKILL_TUTORIAL` starts on wake and asks for the skill while wave 1 (the six subjects) is
  live. After the class is down and the skill beat is done, `beginCellRelease` removes the cell-block
  solid, flashes the bars, marks them open, releases the existing held bodies, and gives the player 1.2 s
  of iframes for the cut. `CALIBRATION_POWER_TUTORIAL` then asks for the heavy while wave 2 is live.
  `campaignPhase === 'release'` updates only those viruses/worms; the gauntlet timers stay parked.
  Clear wave 2 and finish the heavy beat to start the drill. The bars stay open for the rest of the node.
- Data crates are spread through the four rooms. The port is a visual endpoint for now: the node still
  clears on the assault kill count, and no room, cell or port state enters `Snapshot`.
- Room arenas are local-only: `isOnlineArena` skips `rooms`, like the pipe and firewall fixtures. The
  tutorial geometry is not a versus map and must not be selected into a hosted room or online series.

### D42 — Ordinary programs are floating CRT monitors, not roster hulls (built 2026-11-01)

`src/game/regulars.ts` defines the machine world's civilian population as a floating CRT
monitor with an emoji face on its screen. This is the format for **ordinary programs**, not a
new playable hull and not a threat family.

- A regular is a data row (`REGULAR_PROGRAMS`): id, name, role, face, shell colour, screen
  colour and accent. The silhouette is fixed: a shadow/hover ring, a rounded CRT shell, an
  inset screen and one emoji face. There is no body, neck, stand, wheels, arms or legs.
  Adding a regular is a colour/face row, not a second drawing or a per-character renderer
  branch.
- `ArenaDef.regulars` places them by id. `drawRegularPrograms` paints them before pillars and
  cover, so a desk can occlude a monitor. They hover and bob with a per-placement phase. They
  have no `Player` body, collision, health, AI, hit surface, readiness dock or snapshot row.
  Do not add them to `PROGRAMS`, the select screen, `World` or `Snapshot`.
- Emoji faces are colour bitmaps and ignore `fillStyle`; the shell, screen bezel and power LED
  carry the tint. Draw the face on the screen with the emoji font stack, never inside a
  playable program's core or a projectile. No `shadowBlur`, filters or gradients.
- A regular must not read as a combatant: no health segments, hull glyph, lock reticle or
  action marks. The floating CRT monitor is the whole silhouette.
- **Carried files:** `ArenaRegularDef.carry` (0–3) draws small paper files tucked behind the
  monitor. On fear or the campaign's scripted loss the stack drops at the anchor and fades. The
  files are dressing, not props, pickups or hit surfaces; `drawDroppedFiles` owns the flat
  floor papers.
- **Moods:** `RegularMood` is `calm`, `scared`, `angry` or `sad`. Calm uses the portrait face;
  `CIVILIAN_FACES` swaps it for the others. `ArenaRegularDef.mood` sets a baseline for an
  unnamed civilian, and a nearby hostile forces `scared` while it runs. script_kitty keeps her
  cat face and is drawn as a render-only cameo, not an `ArenaDef.regular`.
- **Escape:** this is local presentation only, owned by the renderer. A live hostile inside
  `CIVILIAN_FLEE_RADIUS` (230) makes the civilian drop its files and move at `CIVILIAN_FLEE_SPEED`
  (82) toward the arena port, then a pad/lift, then the room farthest from the threat. A port or
  pad exit fades the monitor out; a safe room becomes its new idle anchor. There is no collision,
  pathfinding or World state; do not turn this into civilian AI or put it in a snapshot.
- Three staff the `QUARANTINE` holding office: TICKET (teal, one file), PATCH (amber, empty-handed)
  and CACHE (violet, two files). They are hidden when the calibration class wakes. PING (rose,
  anxious courier) is defined but unplaced. They are local presentation only, like the tutorial
  rooms themselves.

### D43 — USB HUB is a host-authoritative moving-floor arena (built 2026-11-01; online 2026-11-01)

`USB HUB` (arena id 15) is a round hub with four radial thumb-drive islands. It is content in
`arenas.ts`, not a second traversal or physics system.

- The hub is a 300-radius circle centred in a 1900×1900 camera box. Four 420×240 drives point east,
  south, west and north. Their dock overlap is 70, so the docked silhouette is one connected plus
  shape; the only floor is the hub plus the four drive rectangles. The corners are void.
- All four drives share one cycle: hold in 2.8 s, extend 1.15 s, hold out 3.3 s, retract 1.15 s.
  At full extension the inner lip is 530 from centre and the tip is 950, leaving a **230-unit** gap
  between the hub and each island. A dash is airborne over the gap, but 230 exceeds the 180-unit
  dash, so the fully separated island is not dashable; during the extension travel the gap can still
  be crossed. A walk starts the normal fall. `usbFloorAt` is the shared floor query, and
  `World.checkFall` accepts it only while the body is dashing. Do not add a second gap or dash rule
  for this map.
- Currents are deliberate body drift, not knockback. During extension the lane on every drive
  points outward; during retraction it points inward. The lane is 48 units wider than the drive on
  each side and starts 48 units inside the moving lip, at `usb.flowSpeed` (95 u/s). A body riding a
  drive also receives that drive's per-tick delta, so the plate carries it and the current pushes
  it further. Do not convert this to the shared `kx`/`ky` slide: that would stack knockback with
  the ride and change the felt route.
- `World.usbT` owns the cycle clock and `World.usbRects` owns the current drive rectangles. The
  renderer receives `usbT` in `RenderState` and rebuilds the same geometry through `usbDriveRect`;
  no drive positions are cached in render state. The picker preview uses the same helpers.
- USB HUB is **host-authoritative online**. `SnapshotHazards` carries the shared `usbT` clock at
  index 6 (props move to index 7); the host owns drive movement, carry, currents and falls, and
  guests derive the plates and current overlay from that clock. Do not send drive rectangles or
  current vectors, and do not let a guest simulate or mutate a drive. `isOnlineArena` accepts `usb`
  now; the parser keeps a pre-USB wire shape readable during a rolling reload.
- Local threat content has two explicit adjustments. Infection loads its opening colony onto the
  east drive instead of the missing right-edge floor, and later arrivals queue past that drive tip.
  The opening sentry pack is placed on the hub rather than at the normal view-sized offset, which
  would land in the void. Gauntlet worms and viruses still use the ordinary hub spawn ring.
- Bots use `usbFloorAt` for dash landing checks and an off-floor recovery steer. The static A*
  grid cannot represent a gap that opens and closes, so it is not a complete route model; keep the
  direct edge check in the movement layer instead of baking a fake all-floor grid.

### D44 — SWIPE RIGHT moves the floor with the card deck (built 2026-11-01)

`SWIPE RIGHT` (arena id 16) is a 1000×1800 phone-screen arena. It is an ordinary `ArenaDef` with a
`swipe` record, not a second movement system.

- The deck is presentation data: eight emoji profiles with names, details and accents. A swipe beat
  arrives every 4.6 s, slides for 0.36 s, and carries every live body, projectile, gauntlet threat, drone
  and prop 108 units toward the wall in the beat's direction. The directions alternate. `World` clamps
  the carried bodies to the arena bounds and existing solids; do not add a separate swipe body type.
- `World.swipeT` is the card/slide clock and `World.swipePopupT` is the independent match-popup clock.
  The popup starts warning at 2.8 s, rises over 0.55 s, holds 4.6 s and falls over 0.6 s in a 20 s cycle.
  Its authored rect is solid only while raised; `World.syncSwipePopup` adds and removes it from
  `solids`/`dashSolids`, and `bounceCoverRect` gives shots the same cover response. A body caught under it
  is displaced out, not trapped.
- `SnapshotHazards` carries `swipeT` at index 7 and `swipePopupT` at index 8; props move to 9. The parser
  still accepts the current USB shape (props at 7) and the pre-USB shape (props at 6). Guests derive the
  card, popup pose, warning and floor from those clocks. They never simulate the carry; the host owns it.
  `NetView` exposes both clocks and `LocalPredictor` treats the raised popup as dynamic cover.
- The arena is online-safe (`isOnlineArena` accepts it): the popup and carry clocks are in the snapshot.
  The card and popup are local presentation only and never enter `Snapshot` as extra objects. No health,
  damage or balance numbers were changed for this arena.

### D45 — SATELLITE is a host-authoritative orbital hazard arena (built 2026-11-01; online 2026-11-01)

`SATELLITE` (arena id 17) is the eighteenth arena: a long central hull, two solar wings joined by short
bridges, a telescoping mast below the hull, and three destructible capacitor pods across the top. Its floor
is an explicit union of five rects — hull, port wing, starboard wing and two bridge plates. Outside that
union is a real fall; projectiles and lasers still cross the gaps. The telescope is a moving solid and a
lift, not a new traversal kind. Bots bake the five plates into their nav grid.

- **Solar wings** run independent 16 s cycles (3 s warning, 5.2 s hot, phase offsets 0 and 8 s). A hot
  panel damages every player, bot, hostile and drone body inside its rect on its damage tick. There is no
  player-only filter and no prop damage.
- **Telescope** uses 3.2 s extend / 4.4 s hold / 3.2 s retract / 5.2 s rest. It is cover while extended
  and carries a standing body on its deck; a dash still stops at the barrel.
- **Micro-meteors** begin at 8 s and repeat every 12.5 s: seven rocks with a 0.9 s falling warning, a
  48-unit impact radius and 1 damage. They are a local `SatelliteMeteor` list, not `Projectile`s.
- **Capacitors** are three mounted `Prop`s (64×84, hp 4) at the top. They use the normal shot/melee prop
  damage path, but `launchProp` refuses to detach or throw them. Destroying all three starts a 5 s
  thruster fuse, then a 14 s bottom-up heat front that ticks every 0.8 s for 1 damage. When the front
  reaches the top lip it holds for 2.5 s (or ends early once every body is dead), then the arena cools
  for 5 s and restores the pods. A training respawn cannot leave the map permanently hot.
- The arena is **host-authoritative online**. `SnapshotHazards` carries the solar/telescope clock, the
  thruster fuse, the reentry clock and heat front, plus `[index,x,y,t,hit]` for each live meteor. Capacitors
  are ordinary prop rows; their tenth field marks a capacitor so a guest can draw the pod and its socket.
  The host still owns solar/meteor damage, capsule breaks, mast carry, prop damage and reentry hits;
  `NetView` derives the solar and telescope poses and adds the extended mast to guest prediction.
  `isOnlineArena` accepts it. Do not add per-body hit rows or move the meteor simulation to a guest.
  No health or damage budget was changed for the arena.

### D46 — Session feedback is opt-in, local and anonymized (built 2026-11-01)

Normal play feeds a `SessionTracker` in `src/game/sessionReport.ts`. A new game or run creates one tracker;
`handleGameEvent` adds action, hit, kill and death counts; `syncSessionRound` closes match rounds; the frame
loop samples FPS, frame time and sim time every second while play is live. The tracker stays in memory until
the player shares it.

- `SHARE FEEDBACK` is on the result and leave overlays. It builds a `schema: 1, kind: 'session'` report with
  mode, arena, program, human/bot setup, assist/touch/friendly-fire settings, per-player action totals,
  per-round deltas and deflect sources, result fields, environment and perf samples.
- Sharing is explicit: Web Share with a `deflect-session-*.json` file when the browser supports file
  sharing, otherwise a downloaded JSON plus a copied compact summary. There is no backend, token,
  localStorage upload or automatic network call.
- Callsigns, room codes, IP addresses and raw inputs are absent; player rows use slot labels and program
  names. The report carries the build stamp so old files stay attributable.
- The QA tour's `?playtest=1` log remains a separate developer artifact. Do not merge it into the player
  report or add automatic upload. If remote ingest is later required, put it behind a server endpoint, not
  a client-held key.

### D47 — ROCKET NAVIGATION and WEAPON SYSTEMS are local display arenas (built 2026-11-02)

Both maps are authored `ArenaDef` content, not new engine layers. `rocket` and `weapon` are additive
records beside the existing `satellite`, `usb` and `swipe` fixtures; ids **18** and **19** keep the roster
order after SATELLITE.

- **ROCKET NAVIGATION** runs a 24 s launch. `World.rocketT` and `World.rocketProgress` drive both the
  rendered arc and the collision wall; the renderer samples the same `rocketArcAt` quadratic curve the
  simulation uses. The wall is 128 preallocated, overlapping `Rect`s in `solids` and `dashSolids`, so it
  blocks bodies, dashes and shots without allocating per tick. Inactive blocks are zeroed rather than
  removed. `beginRound()` resets the launch. The rocket, flame, atmosphere departure and stage debris are
  presentation only; a separated stage never becomes a body or pickup.
- **WEAPON SYSTEMS** is a nose-up top-down fighter status console. `FIGHTER_TOP` puts the cockpit and
  nose at the top of the screen. The three large `FIRE WEAPONS`, `EJECTOR SEAT` and `THRUSTERS` banks are
  positioned by the system they describe: fire at the left wing root, ejection beside the cockpit, and
  thrusters by the tail. They are the arena's static cover and controls, not a second player kit; they do
  not fire a jet weapon, eject a body or change thrust. The jet silhouette, readouts and reticle are
  presentation.
- Both maps are **local-only**. They are excluded by `isOnlineArena` because the launch clock/barrier and
  the cockpit display have no `Snapshot` fields. Do not add either to hosted rooms, series or snapshots
  without a protocol decision and guest-side presentation tests.
- Keep the arena geometry in `arenas.ts`; the custom `drawRocketArena` / `drawWeaponArena` branches read the
  records, and both picker previews use the same data. Do not branch on arena names in `World`.
- Neither map changes health, damage or movement budgets. The rocket barrier is dynamic cover, not an
  enemy or a new damage source.
- Known limitation: the precomputed bot nav grid does not include the growing rocket wall. Bots can path
  through the line while it is short; this is acceptable for the local display arena until the barrier
  gets a nav representation or online support.

### D48 — Multiplayer status is local telemetry, not synced game state (built 2026-11-02)

Online rooms expose a small read-only `MpStatus` from `HostNet` and `GuestNet`: role, room code, local
slot, connected count, capacity, smoothed application RTT and measured snapshot cadence. It powers the
lobby `RTT` stat and the `MP STATUS` panel in the game HUD.

- RTT is application-level. `MSG.PING` carries a send timestamp and `MSG.PONG` echoes it; each side
  computes the round trip locally and smooths it. PeerJS/WebRTC exposes no portable RTT field. Hosts
  average their connected guests; guests measure the host. A missing reply leaves the field at `--`.
- Snapshot cadence is measured from snapshots the peer actually received or sent over a one-second window,
  not copied from `NET.snapshotHz`. Older peers that ignore the ping messages still connect and play; their
  status simply stays at `--` for RTT.
- This is **local telemetry**. Do not put `MpStatus`, ping packets or the panel into `LobbyState`,
  `Snapshot` or any world state, and do not let it influence simulation, scoring, input or prediction.
- The panel hides with `GAME UI`/`?ui=0`, during loading and while a screen overlay owns the view. It must
  not become a canvas name plate, minimap marker or per-player health read.
- Known limitation: no two-real-client latency/loss test exists yet. `pollStatus` is rate-limited to one
  ping every two seconds and never retries a lost ping immediately.

### D49 — SPEAK & FIND and CAR NAVIGATION are local display arenas (built 2026-11-02)

Both are authored `ArenaDef` content beside the earlier display maps. `seek` and `car` are additive
records; ids **20** and **21** follow WEAPON SYSTEMS. Neither changes player health, kits or damage.

- **SPEAK & FIND** is a children's talking-picture toy. `ArenaSeekDef` owns the prompt deck, picture cards
  and display rectangle. The renderer cycles a prompt, pulses the matching card and sweeps a magnifier;
  those are presentation only. The four chunky letter keys are the arena's static cover. The cards never
  become pickups, targets or collision.
- **CAR NAVIGATION** is a GPS/map screen cut into two districts. Farmland, farm cover and the winding
  country lane sit west of `ArenaCarDef.cityX`; a street grid and city blocks sit east of it, and every
  route leg east of that line is axis-aligned to a street. `ArenaCarDef.route` is the ordered polyline;
  `World` samples it into 160 preallocated overlapping `Rect`s in `solids` and `dashSolids`. `carT` and
  `carProgress` drive both the rendered route and the barrier, exactly like the rocket arc. Only the newest
  `trailLength` (620 units) stays live; older blocks are zeroed as the car advances, so the wall recedes and
  never becomes a full-map divider. The car, pins, fields, tree cover, river, bridge, grid, park and
  speed/ETA readout are presentation; `pillars` is the only static cover, with the first `farmCount` entries
  as farm buildings and `labels` naming every building in order. `beginRound()` resets the route, and the
  route blocks use the same body, dash and shot collision path as the rocket wall.
- Keep both maps **local-only** through `isOnlineArena`; their clocks are not in `SnapshotHazards` and a
  guest has no route/card presentation. Do not add either to hosted rooms or series without a protocol
  decision and guest tests.
- The car barrier needs 160 blocks so its sampled spacing stays below the authored thickness. Do not lower
  the segment count without checking the longest route leg; a gap would become a walkable hole. Keep the
  live trail capped by `trailLength` (620 units); a wall sampled from route start to the car would divide
  the whole arena and must not come back. The country-to-city route is about 3.2k units over `duration` 32 s,
  so the wall still advances near the old 100 units/s pace. Keep every city leg square to the grid: the
  street drawing and the 180-unit cell spacing assume it.
- Map buildings must clear the route centreline by at least the barrier half-thickness plus a player radius
  (35 units); `.tmp/car-arena-check.ts` samples the whole route against every pillar and every spawn.
- Known limitation: the precomputed bot nav grid does not include the moving car trail (the same limit as
  the rocket arc), so bots can path through it. This is acceptable for the local display arena until the
  barrier gets a nav representation or online support.

### D50 — PONG is a local rally arena (built 2026-11-02)

PONG is id **22**, after CAR NAVIGATION. `ArenaPongDef` owns the court, paddle dimensions, serve speed,
serve delay, bounce angle and damage. The cabinet, scanlines, scoreboard and paddle labels are
presentation. This is an arcade screen used as a floor, not a second game mode.

- `World` advances one live rally: automatic paddles track the ball, the ball bounces off the court's top
  and bottom, and a missed ball scores for the opposite side then serves again after `serveDelay`.
  `beginRound()` resets the score, paddles, serve clock and ball.
- The ball is a **local hazard**. It damages and ricochets off players, the training drone and every
  gauntlet threat family. Dashing and phased bodies avoid it. The death source is `SRC.PONG`.
- Paddles are screen rails, not body or shot cover. Players may stand on them; only the ball threatens a
  body. Do not add paddle collision without a separate dynamic-cover decision and bot-navigation work.
- Keep PONG **local-only** through `isOnlineArena`; its rally ball and score are not in `SnapshotHazards`.
  A guest has no court presentation, so do not add it to hosted rooms or series without a protocol
  decision and guest tests.
- The court has no static cover by design. The moving ball is the arena's pressure; adding pillars would
  make the ball read as random rather than as a Pong rally.

### D51 — AIRPORT is a local split-flap hazard (built 2026-11-02)

AIRPORT is id **23**, after PONG. `ArenaFlipDef` owns a six-row arrivals/departures board, the time-tile
geometry and the flip cycle. The flight text, gate labels, terminal furniture and gate windows are
presentation. This is a terminal floor used as an arena, not a campaign/terminal simulation.

- Six time tiles are the hazard. `World` advances `flipT` and resolves a staggered wave through
  `flipRowStateAt`; a tile warns, then `slamFlipRow` damages and shoves anything on its footprint. The
  board text cycles through each row's `times` deck with `flipRowTimeAt`. `beginRound()` rearms the clock.
- The board's time cells are **not solid cover**. They are floor hazard tiles: bodies can walk over them,
  and the flip is dodged by leaving the tile or being airborne in a dash. The benches and desks in
  `pillars` are the static cover.
- Keep AIRPORT **local-only** through `isOnlineArena`; its flip clock and row states are not in
  `SnapshotHazards`. Do not add it to hosted rooms or series without a protocol decision and guest tests.
- Known limitation: the precomputed bot nav grid cannot represent the moving time-tile hazard, so bots can
  stand on a warning tile. Keep the warning readable rather than making the tile a hidden trap.
- All timing and damage values live on the arena record; do not add a second flip clock or a global board
  constant in `World`.

### D52 — SPACE INVADERS is a local cannon arena (built 2026-11-02)

SPACE INVADERS is id **24**, after AIRPORT. `ArenaInvadersDef` owns the presentation fleet, cannon geometry,
shot speed, cadence, telegraph and damage. The fleet, starfield, score readout and cannon are presentation;
the three bunkers in `pillars` are static cover.

- A simulated arcade player patrols the bottom (`invaderCannonX`), picks the nearest horizontal live body and
  fires upward shots from `invaderShots`. Shots stop on bunkers and damage players, the training drone and
  every gauntlet threat family. Dashing and phased bodies avoid them. The death source is `SRC.ARCADE`.
- `resetInvaders()` clears the cannon, aim lead-in and all shots; `beginRound()` calls it. The cannon, shots,
  aim line and fleet clock are local simulation only.
- Keep SPACE INVADERS **local-only** through `isOnlineArena`; none of its state is in `SnapshotHazards`. Do
  not add it to hosted rooms or series without a protocol decision and guest tests.
- Do not make the invader formation collision. It is the painted enemy-fleet floor; the bunkers are the
  readable cover. Do not add a second projectile system for the cannon; its local shot array is the hazard.
- Known limitation: the cannon targets and shoots bots without a bot-specific dodge response, and the bunkers
  are already in the nav grid while the cannon shots are not.

### D53 — FAX MACHINE is a local row-printing arena (built 2026-11-02, revised 2026-11-02)

FAX MACHINE is id **25**, after SPACE INVADERS. `ArenaFaxDef` owns the page bed, document stack, compact
head dimensions, row count, travel speed, line-feed time and damage values. The page copy, routing block,
chassis, rails and status labels are presentation; the four corner toner drums and paper stacks in
`pillars` are static cover.

- The carriage prints one row at a time, alternating direction: even rows print right, odd rows print left.
  At the end of each row it feeds down one line, then starts the next row from the opposite edge. The page
  cycle repeats after `rows` rows. `faxCycle()`, `faxRowAt()`, `faxPhaseAt()`, `faxHeadX()` and
  `faxHeadY()` are the single source of truth for the renderer and the world.
- Only the compact head is hot, not the whole row. Its rectangle damages players, the training drone and
  every gauntlet threat family once per row, with `SRC.FAX` as the death source. Dashing and phased bodies
  avoid it. The line feed is the reversal/telegraph beat and is never hot.
- `resetFax()` clears the clock, page, row and per-row hit masks; `beginRound()` calls it. The head, row,
  page and phase are local simulation only.
- Keep FAX MACHINE **local-only** through `isOnlineArena`; none of its state is in `SnapshotHazards`. Do not
  add it to hosted rooms or series without a protocol decision and guest tests.
- The sheet is a floor object, not solid cover. Do not add the carriage as a body or projectile collider; the
  head rectangle is the only physical rule. Do not add a second scanner read line to this map.
- Known limitation: the precomputed bot nav grid cannot represent the moving head, so bots can stand in its
  path. Keep the compact head and line-feed beat readable rather than making it a hidden trap.

### D54 — SMART PLUG is a local circuit-ring arena (built 2026-11-02)

SMART PLUG is id **26**, after FAX MACHINE. `ArenaPlugDef` owns the four socket-to-socket arcs, the safe,
warning, live and cooldown phases, arc band width, damage and shove. The four dual-socket modules in
`pillars` are static cover. The board traces, LEDs, voltage watermark and status labels are presentation.

- The four arcs form a ring between the module faces: top, right, bottom and left. They share one clock.
  Green is safe, a short red blink warns, the red pulse is live, then the board cools. `plugCycle()` and
  `plugPhaseAt()` are the single source of truth for the renderer and the world.
- The arcs are **floor hazards**, not solid cover. Bodies and shots pass over the board; only the live band
  damages. Dashing and phased bodies avoid it. The death source is `SRC.PLUG`.
- One hit per body per red pulse is enforced with per-family masks cleared on live entry. A second arc
  cannot double-hit the same body in the same pulse. The centre and the outside are safe pockets; crossing
  the ring is a timing choice.
- `resetPlug()` clears the clock and hit masks; `beginRound()` calls it. Keep SMART PLUG **local-only**
  through `isOnlineArena`; none of its state is in `SnapshotHazards`. Do not add it to hosted rooms or
  series without a protocol decision and guest tests.
- All timing and damage values live on the arena record. Do not add a second plug clock, a global circuit
  constant or a separate electric projectile system.
- Known limitation: the precomputed bot nav grid cannot represent the live ring, so bots can cross into it.
  The green guide, red warning and live arc need to stay readable rather than becoming a hidden trap.

### D55 — SMOKE DETECTOR is a local alarm-ring arena (built 2026-11-02)

SMOKE DETECTOR is id **27**, after SMART PLUG. `ArenaSmokeDef` owns the four sensor pads, fixed battery,
alarm duration, cooldown, wave cadence, speed, width, range and damage. The detector ridges, vents, LEDs
and siren horn are presentation. The round plate is a `disc` with zero spin, no holes and a zero-length
arm; the disc gives the floor a real circular drop without introducing a second round-floor system.

- A live body standing on any of the four floor sensors starts one timed siren burst. The alarm emits an
  expanding ring every `waveEvery` seconds; a ring damages each body once, with `SRC.SMOKE` as the death
  source. Dashing and phased bodies avoid it. After the burst, `sensorCooldown` keeps the sensors quiet
  before they can arm again.
- The mounted battery is a fixed `Prop` with six health. `fixed` props are never launched, moved, separated
  or drawn as file boxes. Shots stop on the battery and damage it; when it goes inactive, `tickSmoke` stops
  the siren, clears live rings and prevents further sensor triggers for the round. `beginRound()` calls
  `resetSmoke()` to clear the clock and restore the battery.
- `buildSnapshotHazards` skips fixed props, so the battery is not serialized. Keep the arena **local-only**
  through `isOnlineArena`; the alarm clock, rings and battery are not in `SnapshotHazards`. Do not add it to
  hosted rooms or series without a protocol decision and guest tests.
- The sensor pads and alarm rings are floor hazards, not solid cover. Do not turn the siren into a second
  projectile system or make the round plate a second collision layer. All timing and damage values live on
  the arena record.
- Known limitation: the bot nav grid cannot represent the live ring or sensor pads, so bots can step on a
  sensor or into a wave. The warning rings and battery state need to stay readable rather than becoming a
  hidden trap.

### D56 — SMART WATCH is a local second-hand arena (built 2026-11-02)

SMART WATCH is id **28**, after SMOKE DETECTOR. `ArenaWatchDef` owns the face rectangle, hand length and
width, angular speed, damage and shove. The four raised app complications in `pillars` are static cover;
the bezel, digital crown, minute ticks, time readout and app glyphs are presentation.

- The orange second hand starts at twelve and sweeps clockwise at `watch.speed`. Bodies within half the
  hand width plus their radius of the forward segment take `damage` and `knockback`; dashing and phased
  bodies avoid it. The death source is `SRC.WATCH`.
- The hand is a floor projection, not a body that stops on cover. It passes over the four app cards and
  can hit a body behind them. Cover still stops bodies, dashes and shots by the normal arena rules.
- One hit per body per revolution is enforced with per-family masks cleared when the hand wraps through
  twelve. Do not reset the masks on every tick or the hand becomes a continuous grinder.
- `resetWatch()` rewinds the clock and clears the masks; `beginRound()` calls it. `buildSnapshotHazards`
  does not serialize the hand. Keep SMART WATCH **local-only** through `isOnlineArena`; do not add it to
  hosted rooms or series without a protocol decision and guest tests.
- All hand timing and damage values live on the arena record. Do not add a second watch clock, a global
  sweep constant or a separate beam projectile system.
- Known limitation: the bot nav grid cannot represent the hand, so bots can walk through it or stand in
  its path. The hand and its pivot need to stay readable at play size rather than becoming a hidden trap.

### D57 — BUSINESS LAPTOP is a local moving-mail arena (built 2026-11-02)

BUSINESS LAPTOP is id **29**, after SMART WATCH. `ArenaLaptopDef` owns the screen, inbox and preview panes,
card count and dimensions, scroll speed, message interval and the authored preview layouts. The email
variant is the first playable screen; a spreadsheet or chat riff must extend this same record and its
data, not add a second laptop simulation.

- The left inbox is a looping vertical conveyor. `laptopCardY()` is the single source of truth for card
  positions; the renderer and the host's collision rectangles both read it. Cards wrap from the top back
  to the bottom. Cards outside the inbox are collisionless for that frame.
- Inbox cards and the active message's `layout` blocks are **dynamic solid cover**. They are not in
  `arena.pillars`: `laptopSolids` is the live list used by player, threat, projectile, bomb and laser
  collision. The preview layout swaps with the message every `messageEvery` seconds and raises a
  new-message flash. There is no damage source attached to the swap.
- `tickLaptop()` advances the scroll and message clocks before bodies move; `resetLaptop()` rewinds the
  cards, message index and flash in `beginRound()`. Keep BUSINESS LAPTOP **local-only** through
  `isOnlineArena`; the clock, card positions and layout are not in `SnapshotHazards`. Do not add it to
  hosted rooms or series without a protocol decision and guest tests.
- A campaign node can point at this arena id as a screen location; no campaign node is attached yet.
  Do not make the campaign's narrative depend on the inbox layout or message index.
- Known limitation: the bot nav grid cannot represent moving cards or changing preview cover. Bots can
  be pushed by a card and can stand where a new layout appears; the flash and card movement need to stay
  readable rather than becoming a hidden trap.

**Variants (built 2026-11-02, v0.1.124).** SPREADSHEET (id 30) and CHAT (id 31) are the two screen riffs the
notes recorded, and both extend `ArenaLaptopDef` rather than adding a second screen simulation:

- `variant` picks the chrome: absent or `'mail'` is the inbox, `'sheet'` is the cell grid, `'chat'` is the
  bubble conveyor. Keep new content inside those three; a fourth draw path that reimplements the clocks is
  the failure mode this rule exists to prevent.
- SPREADSHEET cells are `laptop.sheet.cells` as `{col,row,hp}`, laid out by `laptopCellRect`. Every intact
  cell is in `laptopSolids`. A **direct ranged shot** spends one hit, and a cleared cell zeroes its rect so
  the lane opens until the round ends. `resetLaptop()` restores every cell's authored health and the cursor.
  Bombs and the heavy beam stop on a cell without chipping it, because those paths carry no cover target;
  that asymmetry is deliberate. Re-test spawn clearance before teaching another path to damage cells.
- CHAT bubbles ride the same conveyor with `bubbleW`: they alternate the right and left half of the pane, so
  the open lane zig-zags. The authored record uses eight cards and a `cardGap` of 96 so a body can pass
  between bubbles; do not shrink that gap to fit another row. Each bubble wraps on its own slot below the
  pane (the `chat` branch of `laptopCardY`), so only the bubble leaving the top re-enters and the thread
  never jumps as one block. MAIL keeps the shared scroll. A card is solid only while **fully inside the
  pane**; a clipped card mid-wrap is invisible and must not keep blocking a spawn row. That rule is shared,
  so the mail inbox obeys it too.
- Both variants stay local-only through `isOnlineArena` (`!a.laptop` already covers them). Their clocks,
  cell health, cursor and bubble positions never enter `SnapshotHazards`.

### D58 — Ports are the threat ingress in campaign and infection (decided 2026-11-02, built v0.1.125)

Campaign and INFECTION levels must not materialize threats at arbitrary floor points. Threats arrive through
**ports**: red glowing squares that leak small square particles, emit the level's threat families, and close
permanently when damaged. A level is cleared by destroying the threats already in play **and** closing every
port; threats delivered before a port died stay alive, so closing a port never ends a fight by itself. The
party also gets **white** ports at each level's entry and exit for arriving and leaving — traversal dressing
that is never solid and never damageable.

**Built (v0.1.125) for BUILD ROOT.** `ArenaDef.ingress` authors each port; `World.spawnCampaignPorts` adds
them to the prop pool as `fixed` records, so the existing `damageProp` shot, lash and blast paths close
them — do not add a second damage system or a second entity type. **Every damaging action closes a port**: ranged shots stop on it, the lash and guard chips it, each damaging skill (Toxic's spray and jet, Sweep's split brooms) and each damaging super (Probe's beam, Wedge's bracket and plow, Sweep's stroke, the charged dash) resolves against it too, gated by a per-port 0.3 s contact cooldown so a per-frame attack cannot delete one in two ticks. Health and cadence are tuned together and authored per port (BUILD ROOT: 20–26 hits, one emission every 2.6–3 s); a tough port that trickles threats is boring, a fragile one that floods is noise. `updatePortals` runs the emission clock
and the 0.9 s collapse, the families reuse `spawnSentry`/`spawnVirus`/`spawnWorm` and respect the live
caps, and a port's `bridge` index releases that deck only once every port sharing it is closed. Closing
all of them pushes the white exit port onto the uplink and hands the story box to
`KITTY_UPLINK_TUTORIAL`; walking into the exit clears the node, so live threats never hold a finished
level open. The level still opens populated: `seedAssaultFloor` posts a capped squad on every plate and
the ports add to it. INFECTION still seeds through `setupInfection` and `spawnVirusCluster`; routing that
flood through ports is open work behind the same data.

- The clear condition replaces the bare kill count. `CAMPAIGN.killsToClear` (`tuning/campaign.json`, 10) and
the one-pip-per-delete objective strip in `render.ts` are today's gate; they become **ports remaining plus
live threats**. Do not ship a kill counter and a port counter as two competing objectives.
- Replace the existing spawn paths instead of layering on them: `spawnSentryPack` (a ring around the
player), `spawnVirusCluster` (a far arena spawn point) and the `setupInfection` opening flood all become port
emission. Keep the existing pools, live caps, `packStagger`, interval tapering and wave gates; do not add a
second spawn clock.
- Ports are **authored per arena** on `ArenaDef`, not rolled at runtime. A fair lane, a readable boss room
and a route plate all need known positions; randomness belongs to emission timing and a small offset.
- A port must read as damaged before it closes: give it health, a cracked or dim state and a close beat.
"I shot it and nothing happened" is the failure mode.
- Bots must target a port when no player is in range, or they idle once the floor is clear.
- Ports stay **local-only** like the rest of campaign and INFECTION: not in `Snapshot`, `NetView` or
`SnapshotHazards`. Hosted co-op infection still ships only the colony readout; do not send port geometry over
the network without a protocol decision.
- script_kitty is the mission-control voice for the hop: the network map, the open ports, the next island. It
stays inside the narration rules (bottom box, live and non-blocking, skippable, cosmetic, local-only) and
never becomes a menu, an HUD dump or a gameplay gate.
- Keep a port's footprint readable at play size, like the SMART WATCH hand and the laptop cards; a source the
nav grid cannot represent lets bots stand inside it and turns the objective into a hidden trap.

### D59 — Plate floors and earned bridges (decided 2026-11-02, built v0.1.125)

An arena can declare `islands: Rect[]`. When it does, the plates are the **only** floor: there is no
arena-wide rectangle underneath, the gap is a real drop, and a body carried over an edge falls and
de-rezzes exactly as it would off an open-lip arena. Do not paint plates on top of a shared floor again —
that was the first BUILD ROOT, and it read as one big rectangle with room outlines drawn on it.

- Every plate needs a `rooms` entry with the same rect, so its theme, label and dressing follow it. Spawns,
  cover, props and ports must sit on a plate; `.tmp/islands-ports-check.ts` asserts it and fails the probe
  otherwise.
- Crossings are `bridges`. A deck with `closed: true` is a body barrier **and** a dash blocker until
  `World.openBridge(i)` extends it; `bridgeMask` is what the renderer reads. Author gaps wider than a dash
  so a shut deck cannot be skipped, and release a deck on a milestone the player caused (a cleared block,
  a closed port), never on a timer alone.
- Off a plate is a death, not a reset. That is the price of real islands: keep spawns and tutorial beats
  away from the rims instead of adding safety rails the level does not earn.

### D60 — Replicators are the second ingress (decided 2026-11-02, built v0.1.127)

A port only makes sense where the fiction allows an open network connection. Some devices do not: a
satellite with an intermittent link, an offline box, a machine that only reaches a network when it is
carried into range. Those get a **replicator** (`ArenaDef.replicator`) instead — a machine installed on the
device that prints copies of one specific threat family onto the floor. It is the infection's answer to a
device it cannot keep a socket open on: it stocks up locally and floods the network whenever the link
returns.

- A replicator shares the port clock, the damage path and the close beat (`portal` plus `replicator` on the
  prop). Do not fork a second emitter: if damaging or closing changes for a port, it changes here too.
- It prints **one** family, never a mixed pool. It releases no bridge and never counts toward
  `portsClosed` or `portTotal`, so a level's port objective cannot be satisfied by shooting a copier.
- It is authored per arena and local-only, exactly like a port: no `Snapshot`, no `SnapshotHazards`.
- Use it for devices whose identity is intermittent or hardwired. Do not use it as a reskin of a port on an
  ordinary networked device; a printer inside a laptop screen is not the story.
- SATELLITE is the first fixture: a hull-side copier printing pulse units every 4 s at 24 health.

### D61 — CAPCOM is a mission-control plate arena (decided 2026-11-02, built v0.1.128)

CAPCOM (id 32) is the 1960s mission-control arena: four separate plates in a 2×2 ring, each one a
department — CAPCOM (flight control), FIDO (flight dynamics), GUIDO (guidance) and EECOM
(electrical/environmental). The point is that the floor reads as the room it is imitating rather than four
copies of one console bank.

- It uses the plate grammar from D59: the plates are the only floor, and all four decks start open because
  this is a versus and gauntlet map, not a campaign node. Gaps stay wider than a dash so the ring is the
  route.
- The `console` room theme draws the CRT bank, the plotting board with a live trajectory and the mission
  clock. The department name comes from the room label, so a new department is a data entry, not another
  draw function. Do not fork a theme per department.
- Console banks are the cover pillars, so the furniture and the fiction are the same objects. A new
  department's cover belongs in `pillars`, not in the theme.
- Room arenas stay out of hosted rotation (`isOnlineArena` excludes `rooms`), so CAPCOM is local-only like
  QUARANTINE. Do not add an online path for it without a protocol decision.
- It authors no `ingress` and no `replicator`: it is a fighting map. Ingress fixtures belong to campaign and
  infection nodes.


- **Each department owns its furniture and its cover.** `ArenaRoomDef.variant` picks the console-room
  set: `flight` (CAPCOM) draws the tiered CRT bank, trajectory board and clock; `dynamics` (FIDO) draws
  paper recorders and a tilted plotting table with two crossing plots; `guidance` (GUIDO) draws a turning
  gimbal cage over a fixed core, a star-fix board and an attitude readout; `systems` (EECOM) draws bus
  bars, breakers and a gauge cluster. The plate does not change theme, only variant, so the palette stays
  one room.
- **Cover is per department too.** `pillars` holds a different bank arrangement for each plate: CAPCOM's
  two offset tiers, FIDO's three plotting tables, GUIDO's central pedestal plus four corner racks, and
  EECOM's wall racks plus two breaker cabinets. Keep every spawn at least `PLAYER.radius + 6` clear of a
  bank; the probe enforces it. The ring, the open decks and the dash-proof gaps are unchanged.
- `.tmp/capcom-check.ts` asserts four distinct variants, four distinct bank signatures, every plate owns
  a bank, and no spawn sits inside one. Extend it when a department is added.
### D62 — AIR TRAFFIC is a radar scope with aircraft as hazards (decided 2026-11-02, built v0.1.129)

AIR TRAFFIC (id 33) is an air traffic control scope: a circular radar floor with a slow sweep and aircraft
crossing it. The planes are the arena's hazard, so they are simulated, not decorated.

- The floor is a disc (`radar.cx/cy/radius`); `inVoid` treats everything outside it as a drop, like the
  other open-lip arenas. Cover is six console desks authored inside the disc.
- `World.tickRadar` advances one clock (`radarT`) and derives every plane position from it. The renderer
  reads the same clock, so a drawn plane is exactly where the damage is. Do not give planes their own
  integration state; a straight-line pass on a fixed clock is the whole model.
- A pass damages players and, in gauntlet, worms, viruses, sentries, the training drone and cascading
  errors. Damage is one hit per plane per pass per body (`radarHit*` bitmasks, cleared when a pass wraps),
  so a slow aircraft cannot shred a body by overlapping it for several frames. Dashing, phasing, cloak and
  i-frames still void the hit.
- The sweep is presentation only and deliberately slow (`sweepPeriod` 11 s). Do not make the sweep a damage
  source; the aircraft are the threat, and a second sweeping hazard would make the floor unreadable.
- Traffic is content: `ArenaRadarPlaneDef` carries the tag, bearing, heading, entry distance, run, speed,
  radius, period and delay. Every pass must cross the disc — an aircraft whose perpendicular distance from
  the centre exceeds `radius` is decoration and fails the probe.
- It authors no `ingress` or `replicator`, and `isOnlineArena` excludes `radar`, so it is local-only like
  the other fixture arenas. Aircraft never enter `Snapshot`.

### D63 — AIRPORT is the board, and every line flips (revised 2026-11-02, built v0.1.130)

The AIRPORT floor used to be a terminal with a split-flap board standing on it: most of the arena was
apron, and only the time tile could hurt a body. That is the wrong shape for a level about a board.

- The board now fills the arena (`flip.board` covers the bounds, and `pillars` is empty). There is no
  terminal floor, no gate windows and no benches: the rows are the terrain. Do not put furniture back
  outside the board; add a row instead.
- Eighteen rows in two banks (`banks: 2`), nine arrivals on the left and nine departures on the right, so
  cells stay legible at floor scale instead of stretching a destination across the whole arena.
- **Every text field is a flipboard element.** Time, destination, gate and status each cycle through their
  own deck (`flip.destinations` / `flip.gates` / `flip.statuses`) and each cell animates its own squeeze,
  rippled a beat behind the time tile so the row reads as one machine working. A new field is another deck
  and another cell, not a static label.
- A landed row damages its whole band (`flipRowRectAt`), not just the time tile, because the whole band is
  a flap bank now. One landing per row per period, resolved on the frame the flap starts.
- Rows are staggered (`stagger: 0.28`) so the board flips as a wave across both banks rather than all at
  once.
- Still local-only: `isOnlineArena` excludes `flip`, and its clock stays out of `SnapshotHazards`.

### D64 — The WEAPON SYSTEMS jet is a top-down plan view, shared with the picker (revised 2026-11-02)

The console originally drew a side profile, which put the cockpit at the side and left the three banks in
one unrelated column. The arena now reads as a plan view with the cockpit and nose facing up, so each
bank can sit beside the aircraft system it names.

- `FIGHTER_TOP` in `arenas.ts` is the single source. Coordinates are normalized: x 0 is the left wingtip,
  1 the right wingtip; y 0 is the nose, 1 the tail. It carries both wings, tail planes, shoulder intakes,
  a forward canopy, a centred tail fin and a rear nozzle.
- Both consumers draw it: `drawWeaponArena` fills and strokes it with console colours and adds a centre
  spine, wing-root seams, hardpoints, exhaust streaks and a `TOP PROFILE` caption, and the arena picker
  traces the same shapes scaled down. Never re-inline a polygon in either place; the probe fails if the old
  blob returns or if either draw stops referencing `FIGHTER_TOP`.
- The banks follow the aircraft: `FIRE WEAPONS` is beside the left wing root, `EJECTOR SEAT` beside the
  cockpit, and `THRUSTERS` beside the tail. Keep that spatial relationship when moving the jet or resizing
  the arena; a bank in a generic column is the failure this layout fixes.
- The reticle sits over the nose at the top of the box, and the exhaust streaks run below the tail. Keep new
  features on the plan-view axes so the drawing stays one aircraft.

### D65 — Gauntlet arrivals come in bursts from map edges (decided 2026-11-02, built v0.1.132)

Gauntlet threats used to appear on individual timers, with sentry packs landing in a ring around the
player. On a wide arena that read as enemies materialising in your footprint, and it produced the "survive
one second, then get surrounded" run the demos kept showing.

- Arrivals are now **edge ingress bursts**. `World.queueAssault(family, kind, count)` fills a pending queue
  (family 0 sentry, 1 worm, 2 virus) and `tickAssault` opens a red square portal on an arena edge, emits the
  batch at the mouth over roughly a second, then closes. Nothing spawns in the middle of the floor.
- Placement is chosen in `assaultPoint()`: sample all four edges at `GAUNTLET.assault.edgeInset`, keep only
  points clear of cover and at least `playerClear` (430) from the player, then take the farthest. If no edge
  point qualifies the burst waits; it never falls back to a spawn near the body.
- The beat is: open 0.32 s, one arrival every 0.13 s with a small scatter, close 0.55 s, 1.1 s between
  portals, at most two portals at once. All of it lives under `GAUNTLET.assault` in `tuning/threats.json`.
- Sentry packs, worms and virus clusters all feed the same queue. A pack request now waits for the pending
  burst (`assaultQueueCount === 0`) before queueing again, so a wave cannot stack two bursts on top of the
  cap. Caps are still checked when the request is made.
- `spawnSentry` takes a `burst` flag: tight jitter (±24) and a 110-unit player clearance instead of the old
  150/110 ring and 240 clearance, because the portal itself already keeps distance.
- Portals are local-only (`AssaultPortal`, never in `SnapshotHazards`) and drawn by `drawAssaultPortals`,
  which shares the red-square language of campaign ingress. Do not reintroduce a direct gauntlet spawn.

### D66 — Mega Worm is the first boss: one straight sponge you out-position (decided 2026-11-02, built v0.1.133, revised v0.1.150)

The Mega Worm is a boss built on the existing `Worm` entity, not a parallel creature. That is deliberate:
every weapon, blast, hazard, bot scan and minimap read already walks `world.worms`, so the boss inherits
them all. It occupies `MEGA_WORM.slots` extra pool bodies beyond `GAUNTLET.maxWorms`, and every cap that
counts normal worms excludes `mega`.

Mini-bosses are registry content, not special cases. `src/game/minibosses.ts` lists each boss with an id,
label, tuning block and body shape; `Worm.bossKind` carries that id; and `World.spawnMiniboss(kind, x, y)`
is the only entry point. Assault family 3 carries the id in its existing `kind` field, so a mini-boss is
delivered by the same edge portal as a sentry, worm or virus and can be scheduled by any wave or level.

- **Scale pass (v0.1.143).** The Mega Worm is a 3x silhouette: `headRadius` 138, `segmentRadius` 99,
  `spacing` 168, with health doubled so it still reads as a boss. Health and radii are settled; do not
  change them without explicit approval.
- **One straight body that bends in turns (2026-11-02).** `followMegaChain` trails each plate one
  `spacing` behind the one ahead with `followRate`. A straight run reads as one rigid line; a turn bends
  the chain along the head's path instead of pivoting the whole body like a stick, which is what made the
  old model cross over itself. Do not restore the spiral arrival.
- **Offscreen entrance (2026-11-02).** `spawnMegaWorm` places the head `entrance.offscreen` beyond the
  arena's longest half-axis, then runs a 6.2 s arc around the arena center and inward to
  `entrance.endRadiusMult` before handing off into the first straight pass. It does no bite or acid
  during the entrance. Do not clamp the head back inside at spawn or restore the old assembly wait.
- **The Mega Worm flies.** It has no arena clamp and no cover resolve: the head and every plate can
  leave the floor on a pass, and the camera gets `CAMERA.bossVoidMargin` to look past the lip while it
  does. It is still hittable anywhere, and its attacks still target the arena. `cullVoidThreats` skips
  `w.mega` and the File Blob for the same reason it skips Idle Hands and the Storm Cloud: they fly over
  holes and past the lip, and the floor cull would delete a whole boss mid-pass. Environmental hazards
  still reach them through their own damage paths, so a firewall or emitter burns them normally. Ordinary
  worms, players, pickups, hazards and projectiles keep normal clamping. Do not add `bossEdgePad` back to
  the Mega Worm.

- **One health pool (v0.1.150).** `w.hp`/`w.maxHp` are the only health. `damageMegaWorm` subtracts the
  hit anywhere on the body: there is no nearest-plate routing, no plate break, no head promotion and no
  detach. `headHp` + `segments * hpPerSegment` only computes the total (206); the plate count is
  presentation. Do not reintroduce per-plate health or splitting: detached pieces once left a boss-rush
  stage live forever.
- **Damage is contact, and nothing else.** `megaTouch` on any plate is the whole attack. There is no maw
  snap, no bite, no acid and no legs phase; the head is not a separate creature. Normal worms keep their
  own `WORM` bite in `updateWorm`, which is a different branch.
- **Straight runs, wide turns, never a chase.** After the entrance, `updateMegaWorm` alternates two
  states: a straight run at `flyby.speed` whose heading stays fixed until the head has passed the latched
  point by `flyby.exitRange`, then a wide turn at `flyby.turnSpeed` / `flyby.turnRate` back toward the
  player. It re-aims once when the turn starts; only the turn steers. There is no teleport, no orbit and
  no ground chase. The turn radius (`turnSpeed / turnRate`, 760 units) must stay well above `spacing`, or
  the trailing chain folds through itself; that is the rule, not the size of the old arc. Tuning is
  `speed` 940, `exitRange` 380, `turnRate` 1.0, `turnSpeed` 760 (v0.1.152). The old wide arc
  (1020/700/0.55/620) spent about 80% of every cycle outside the floor: 18 passes over 186 s with an
  always-firing invulnerable pilot, including whole passes that only clipped the lip. The tighter loop
  keeps ~35% of the fight on the floor and clears in 55-115 s depending on the kit. Measure passes and
  uptime before changing these numbers; a slower pass also lets slow-projectile kits land more often.
- **Bosses cannot be infected (2026-11-02).** `infectWorm` refills health because a converted worm becomes
  a thrall. A virus touching the Mega Worm healed it to full mid-fight and made the level unkillable, so
  both the virus host scan and its contact test skip `w.bossKind >= 0`.
- **Collision uses the body's own radii (2026-11-02).** Every worm hit test reads `w.hitR` / `w.segR`, never
  `WORM.headRadius` / `WORM.segmentRadius`, which are the 16/10 normal-worm sizes. Before this a bomb,
  lash or dash only registered within 16 units of the 3x head: Kaboom landed 18 damage in 240 s and
  several kits could not kill the boss at all. `spawnWorm` also resets both radii, because a pooled slot
  that had carried a boss handed a 138-unit hit circle to the next ordinary worm.
- **Blasts reach the whole body.** `explodeBlast` tests the head and every plate, and skips the floor
  line-of-sight check for a mini-boss: a blast on the chain used to do nothing, and every off-map pass
  failed LOS, so explosion kits could not damage it.
- **Arrival cry (2026-11-02).** The entrance is a full lap (`sweep` 6.28) starting beyond the arena lip,
  and it ends on `EV.MEGA_CRY`: a MIDI-note bird phrase (`audio.megaCry`), a 16-unit screen shake, a flash
  and a pressure ring. The first straight pass follows the cry. The cry is an event, not a renderer
  timer, so a guest and the host hear the same beat; keep it out of `Snapshot` like every other local
  cue.
- **Arrival is data.** `GAUNTLET.bossSchedule` entries are `{ kind, wave, repeatStep }`; each gate fires
  once per matching wave and is skipped while that kind is already live. Adding a boss, a harder repeat or
  a scripted level is a registry row plus a schedule entry, never a new arrival path. A boss must never
  materialise beside the player: the Mega Worm uses its offscreen entrance; Idle Hands, Starfish and File
  Blob use near-player staging. `?mega=1` is the QA-only boot hook and never enters menus or `Snapshot`.
- **Hex plates (2026-11-02).** Every plate, the head socket and debris flakes trace `traceMegaHex`;
  cracks radiate across the hex. Do not reintroduce square `fillRect`/`strokeRect` plates.
- **Read.** There is no health bar: every plate shows the same crack level from the single pool, loose
  code debris drifts off the body in proportion to total damage, and the head keeps static eyes with no
  promotion flare. Tune crack counts in `drawMegaPlate`; keep the plate frames and the eye mark so the
  head is always legible.

### D72 — Staged mini-boss entrances freeze the room (built 2026-11-02)

The four staged bosses — File Blob, Mega Worm, Idle Hands and Starfish — own a deliberately longer entrance
cut-in before their normal fight. `World.spawnMiniboss` starts `World.bossIntro` only for the initial arrival;
Starfish hatches use the ordinary spawn path and never replay it. `World.step` returns after
advancing the intro, so players, threats, hazards and the round clock are frozen while the reveal runs.
`bossIntro` is local presentation state and never enters a snapshot. The freeze is part of the read: do not
trim these timings back to combat pace without checking the entrance on screen.

- **Camera and title.** `Renderer.updateCameraCues` handles the intro before the ordinary boss cue, plays a
  `CAMERA.bossIntroZoom` rig at priority 5 and tracks the live `bossIntro.x/y` each frame (the Mega Worm
  crosses the room during its entrance). A short `SUB-AGENT // INBOUND` title card draws over the scene and
  fades with the intro. Do not route a staged boss back through the old generic boss cue.
- **File Blob (3.6 s).** The blob starts as one file glyph, holds the first cluster as a read, then packs
  out to all 96 plates at full size. `drawBlob` derives both the shown count and the hull scale from
  `BLOB.introTime`; the normal health-driven radius resumes after the freeze.
- **Mega Worm (8.8 s).** It starts beyond the longest arena half-axis, follows the 6.8 s `entrance` arc around
  and inward, then holds a 1.5 s roar with a solid maw and expanding rings before handing off to flight. The
  entrance does not bite, whip, spit or damage bodies.
- **Idle Hands (2.7 s).** Each hand rises from below its ground point while making one projected yaw through
  the entrance: front, edge-on, back, edge-on, front. The yaw is `cos(2πu)` on the glyph's x-axis with a
  small `sin(2πu)` in-plane twist; the palm eye is suppressed on the back half so the turn reads as a
  front/back rotation rather than a flat mirror. It then grows and bounces into its normal silhouette. The
  pair still starts in the same ring; only the visual emergence is staged. After the reveal, a hand behind
  the player is steered to the nearest side; a front hand stays in the lower half. The target band is
  `orbitYSide`/`orbitYFront`, and the arrival ring uses `spawnRingY`/`spawnYOffset`. Do not restore a
  full vertical orbit or let a hand target the player's back: that put a palm over the player sprite and
  above the camera frame, where it could not be read or tracked. Hovering hands (states 0 and 3) also run
  a six-pass pair separation with `separation` 340 before the frame; slam, charge and redirect states are
  exempt so committed attacks still land. Do not remove the margin or let the palms stack. This is
  presentation-only and out of `Snapshot`.
- **Starfish (2.9 s).** The center and its attached arms hang 620 units above the landing point for the first
  18% of the entrance, then fall under acceleration instead of easing gently into the floor. A landing ring
  tracks the target, then the body settles into the normal mouth/arm cycle.
- **Storm Cloud** is not in this group yet; it keeps the ordinary combat camera cue.

## 8. Performance guardrails

- Sim target: **< 4 ms** per 60 Hz tick with 8 players and 48 live projectiles on a mid-range laptop.
  Run `npm run bench` after touching the sim. The bench also runs an eight-bot digital swarm
  (AI + sim) so the local bot path cannot regress unnoticed.
- Render target: 144 FPS on integrated graphics. No `shadowBlur`, no `filter`, no gradients per frame,
  no `createPattern` per frame.
- Snapshot budget: keep 8P/48 projectiles at or below ~3 KB. Last measured v0.1.2: 2.88 KB. v0.1.4 adds
  lock and bug fields to every player row, so those sizes must be remeasured before quoting a new cap.
  Use binarypack arrays only; delta compression is deferred until a real playtest shows bandwidth trouble.
- Hazard snapshots: v0.1.88 measured 16 B clock-only and 180 B with seven live boxes. Keep the block to
  clocks, page indices and live props; a new fixture must prove its packet and prediction cost before it
  adds rows.
- Verify player cap with `F3` (frame time, sim time, projectile count) and the bench scenario
  (`?stress=8` spawns eight simulated players in training).
- Bot cost is part of the bench result; do not move AI into `World.step` or allocate per bot per frame.
  A* scratch must stay preallocated (`src/game/nav.ts`); re-plan on a timer, not every tick.
- The gauntlet max case (2 worms, 10 viruses, 2 firewalls, 14 cascading-error blocks, sentries, one
  thrall) is part of `npm run bench`. v0.1.27 measured 0.215 ms/tick avg, p99 0.697 ms with 27.3 live
  threats; the eight-bot swarm measured 0.096 avg / 0.325 p99. Keep it there so threat complexity cannot
  regress silently.
- Measured results live in `TODO.md` §Performance. Do not claim a cap without numbers there.

---

## 9. Verification

```bash
npm install
npm run build      # tsc --noEmit && vite build
npm run bench      # headless sim benchmark
npm run dev        # manual playtest
```

Headless harnesses (`balance.ts`, `bench`) are for the first pass and for repeatable comparisons. Switch to
a headed browser session when the headless data is surprising, noisy, or cannot answer the question: attack
tells, off-screen threats, camera framing, hit feedback, audio cues, route readability, and whether a
control actually feels usable. Use the normal dev server, `?autoplay=N`, `?gauntlet=1&arena=N&bot=1`, and
`F3`; exercise the exact scenario rather than tuning from a table alone. Report headed findings alongside
the headless numbers, and treat a visual/play contradiction as a reason to investigate, not a reason to
discard it.

Manual pass after gameplay changes: training on each arena (move/face/melee lash/held guard/two dodge
charges/ranged stream/skill/power attack), losing each health segment on the local outline, endless
training at each tier and count, VS BOTS at each tier with each program, an unattended `?autoplay=2` run
through a match and rematch, gauntlet on each arena (worm eat/chase, virus split/infection/thrall, sentry stagger and
friendly fire, cascading-error spread, no automatic firewalls, one-life death/results/top table, early
wave gates), settings tabs and option persistence, two browser tabs (create + join on a
non-default arena), round end
and match end, disconnect handling, controller hot-plug, production offline reload. The v0.1.1 pass also ran
a headless 4-arena × 3-tier × 1v1/1v3 bot matrix; every combination reached a match winner. The v0.1 pass also used
an injected virtual gamepad for mapping and a two-tab match for network sync. Eight real WebRTC clients
have not been run; the 8P cap is backed by sim/render stress only.

Known limitations must stay listed in `TODO.md` until fixed. Never mark a networked feature verified
without two real clients.

---

## 10. Out of scope for v1 (do not build without an explicit request)

Networked bot slots, PvPvE enemies **inside competitive matches**, arena hazards/rails/switches/power-ups,
destructible geometry, cosmetics/customization, accounts/persistence, spectators, teams, ranking, Tauri
packaging, self-hosted networking, replays. The phone touch layer (D28) is a first-pass framework,
not a promise of a tuned mobile release. Local test bots (`src/game/bot.ts`)
and the local GAUNTLET sandbox (`World` gauntlet mode) are in scope; they do not change this list into a
promise of online bots or networked PvE.

The core PvP loop, PWA install, controller support, N-player rooms, and training must be solid first.


### D67 — Idle Hands: floating palms, one boss (built 2026-11-02)

The second mini-boss is **IDLE HANDS** (`MINIBOSS.IDLE_HANDS = 1`, body `idle-hands`, gauntlet wave 14,
repeat every 28). It is a pair of hands at once, not two bosses: each palm carries a red eye, hovers, slams,
and can commit to a finger charge.

- **One boss, two bodies, no second collision system.** Hands live in the `worms` pool as boss bodies
  with `bossKind = IDLE_HANDS`, `mega = false`, `segCount = 0` and their own `hand` state object. Because
  `damageWorm` and `updateWorm` dispatch on `bossKind`, every weapon, beam, blast, melee, dash and bot
  scan that already walks `world.worms` reaches them for free. Do not add a parallel `hands` array; that
  would mean re-wiring a dozen hit paths. Anything counting *ordinary* worms must test `bossKind < 0`,
  not `!mega`.
- **Slam (the read).** The hand rises, squashes vertically, flips palm-out, then grows back down through
  the floor onto a ground ring latched at the start of the tell (`slam.aoe` 240, 1 damage, 1050 knockback,
  0.72 s windup, 0.26 s drop, 3.2 s cooldown). State 3 is **hold then rise**: the palm stays pressed flat
  on the floor for `slam.hold` (1 s) and only then plays the 0.35 s rise-out. The hold is deliberately a
  stopped, fully damageable body, so a slam is a damage window rather than a snap back to hover; do not
  move `slam.recover` back over the hold or re-hide the palm behind an animation. The renderer marks it
  with a slow white ring pulse at the palm (a cue, not a second hit ring). The ground point is latched when
  the tell begins, so stepping out of the ring is the counterplay. Landing emits `PROP_BREAK` for dust plus
  a white landing seam; there is no camera shake beyond those two. The renderer owns the squash and flip,
  not the simulation.
- **Finger charge.** The hand turns to point, shakes for 0.8 s, then fires along the latched direction at
  800 units/s for 0.62 s, for 1 damage and 1520 knockback. The slower travel keeps roughly the old reach.
  Cover does not stop it: hands are airborne,
  ignore cover, and only the arena wall ends a charge.
- **The dash redirect.** A player dash that reaches a hand *while it is in its charge dash* does not
  dent it: it redirects the hand along the dash direction at 1100 units/s. A redirected hand that touches
  another hand deals `charge.deflectDamage` (14) to the partner, which is the boss's biggest punish and
  the reason the pair is worth fighting together. Both hands then enter stun state 7: they are launched
  apart at `charge.stunKnockback` (900), spin for `charge.stunTime` (1 s), and cannot attack until the
  lockout ends. Deflect credit goes to the player. Do not gate this on the charged dash specifically; any
  dash that connects during the charge works.
- **Identity.** The palm is a Unicode hand symbol, not a stroked plate: `✋` for the open palm, `☝` while
  pointing, and `👁` for the palm eye, all drawn through the shared symbol stack with text-presentation
  selectors. This reverses the earlier vector-only note on explicit design feedback (2026-11-02); the boss
  should read as a hand mark like the primitive threats, not as a square palm with finger boxes. The
  palm is filled entirely in the red accent over a dark-red silhouette pass; the eye is a fixed, unanimated
  red glyph over an opaque black socket so the palm cannot show through its counters. Do not restore the
  palm plate, four finger rectangles, the drawn ellipse eye, the pale palm fill, or the eye blink/width
  animation. Palette: hand/eye `#ff5a5a`, eye socket `#000000`; no health bar, no cracks — a hand reads by
  its palm eye and its state,
  and dies into the normal shard burst.
- **Render mode.** `drawIdleHand` saves the context and forces `source-over` because `drawWorms` sets
  `lighter` for the whole worm pool. Do not draw the hand under additive blending; its layered fill, eye
  socket and shadow bloom into each other and read as flashing. Restore the pool's blend mode on exit.
  The palm and eye are also **opaque**: `alpha` in the renderer is the fixed-step interpolation factor, not
  an opacity fade, so multiplying the body fill by it made the whole hand strobe at the sim rate. Keep body
  fills at 1 and reserve `alpha` for the charge trail, shadow, telegraph and landing rings.
- **Scale pass (2026-11-02).** Each hand is roughly three times its original body size: `radius` 126,
  spawn ring 390/300, orbit 520–680, slam range 700, slam AOE 240 and rise 360. Health and damage are
  unchanged; scale the spatial values together so two 126-radius hands never spawn inside each other.
  The eye uses a capped 84 px font, so a 3x palm gets about a 2.2x eye and still reads as an eye rather
  than a pupil filling the hand.
- **Hand count is tuning (2026-11-02).** `hands` is **2** for now: three palms give a solo pilot three
  slam/charge angles to cover and played as too hard. The spawn ring, pair separation, redirect and kill
  credit all read the count, so there is no code branch on it; the pair spawns opposite each other and the
  hand-on-hand redirect still lands. Raising it back to 3 is a one-value change, but re-check the separation
  margin and whether a solo player can actually cover the extra angle before shipping it.
- **Near-player staging (2026-11-02).** `spawnMiniboss` places Idle Hands, Starfish and File Blob around
  the nearest live player instead of at the distant assault portal. Hands ring the player; the Starfish
  center sits 440 units toward the arena center; the Blob 360 units, with the anchor clamped by its
  footprint. Mega Worm and Storm Cloud keep their existing staging points.
- **Tuning** lives in `tuning/threats.json` under `IDLE_HANDS`, exported from `config.ts`. `.tmp/idlehands-check.ts`
  covers the trio shape, the slam in and out of the ring, the redirect damage, kill credit and ingress.
  `?hands=1` is a QA-only boot hook beside `?mega=1`; it never enters menus or `Snapshot`.


### D68 — Memory fragments: a downed player feeds the survivors (built 2026-11-02)

A body that dies in a PvE mode leaves a **memory fragment**. Whoever picks it up gains one permanent
stack for that run: **+1 health segment, +20% walking speed, +25% outgoing damage**, up to **three**
stacks. This is the reason PvP is worth playing inside a PvE mode: every fallen teammate or betraying
bot makes the survivor stronger for the rest of the run.

- **Scope.** Every mode except the versus `match` (local and online). Gauntlet, INFECTION co-op,
  campaign and training all drop one. Kiosk/attract runs do not. Thralls and Copy Pasta clones never
  drop one; they are not players.
- **One drop per body per run.** `Player.memoryDropped` latches on the first death, so a respawning
  training bot cannot be farmed for free stacks. In campaign the flag lives on the body, and `main.ts`
  carries the stack count to the next node (`campaignMemory` + `World.setMemoryStacks`).
- **A shard never times out.** It waits on the floor until a body picks it up, the run wipes, or the level
  ends. Do not put a lifetime back on it. A total wipe (`gauntletOver` with no standing body) clears every
  shard, so a retry from the last save point restores only the shards that save carried, never the ones
  dropped during the failed attempt.
- **A level clear is the save point.** On a campaign clear, `main.ts` banks every player's stack count and
  every uncollected shard into the slot (`StorySave.memory`, `StorySave.shards`, positions normalized to
  the arena bounds). The next node restores them with `setMemoryStacks`/`restoreFragments`, scaling the
  saved fractions into the new arena. Shards picked up before the clear are already stacks and are saved
  that way. Older saves without those fields load with zero stacks and no shards.
- **Death source is irrelevant.** Environment, enemy fire or another player all drop the shard, because
  the drop happens in the shared death block of `damagePlayer`, not in a weapon branch.
- **Stacking.** `memory` on the player is the single source. Health adds a real segment (`maxHp`), so the
  program hull draws the extra segment automatically; speed multiplies walking in `movement.ts` only, not
  dashes or plugs; damage scales at the top of every outgoing `damage*` entry point through
  `memoryDamage(sourceSlot, amount)`, so enemies (slot -1) and clones never scale. At the cap the shard is
  left on the floor instead of being wasted.
- **Presentation.** A shard is a spinning diamond over a soft well, magnetised within
  `MEMORY.magnetRadius`. It pulses but never fades out: it is still there minutes later. Rules live in
  `src/game/memory.ts` (`MEMORY`), which is the only place the numbers belong. There is no stack counter in
  the HUD: the extra hull segment is the read, plus the pickup flash.
- **Do not** turn this into a powerup, a snapshot field, or a match rule. It is local run progression,
  like gauntlet records. `.tmp/memory-check.ts` covers the drop, collection, cap, once-per-run latch,
  damage scale (1.75 at three stacks, enemies still 1), respawn carry, campaign carry and match exclusion.


### D69 — Starfish: five detachable arms and a hatchery (built 2026-11-02)

The third mini-boss is **STARFISH** (`MINIBOSS.STARFISH = 2`, body `starfish`, gauntlet wave 20, repeat
every 40). One center and five arms, and the arms are the boss: stripping them opens the mouth, and an arm
left alive grows a whole new Starfish.

- **Scale and silhouette (2026-11-02).** Core radius 96, `armRadius` 92, drawn arm width `armWidth` 0.84
  and `armReach` 435, a girth pass over the 75/69/0.72/435 block, itself 1.5x over 50/46/290. The mouth
  stays 150 and the angry chomp 195. Arms, reach, teeth and the boss staging pad all read from these
  values, so scale the tuning block rather than the draw code. `armWidth` is the one draw factor kept in
  tuning: it thickens the tapered silhouette (attached and detached) without making the collision circle
  wider than `armRadius`. Reach is deliberately unchanged in the girth pass so the boss gets fatter, not
  longer. A detached arm keeps the same curved, tapering arm silhouette and base stump as an attached arm;
  do not restore the old leaf/boat outline.
- **Obstacles do not stop it.** The center and its arms are boss bodies, not the generic chain worm:
  `updateWorm` dispatches to the Starfish updaters before the shared `pushOutOfCover` resolve, so pillars,
  walls and fixtures never shove them. They cross cover the way the Mega Worm crosses it; only the arena
  bounds (with `bossEdgePad`) clamp them. Do not add `pushOutOfCover` to either updater, and keep the
  dispatch branch above the normal worm path.

- **Arms are bodies, not segments.** The center and all five arms are separate `Worm` pool entries tagged
  with `bossKind = STARFISH`; arms also carry `armState` (group, index, attached, hatch timer). That is
  what lets every existing weapon, beam, blast and bot scan hit a specific arm without new collision
  plumbing. `minibossLiveCount` must skip `armState` bodies or one boss reads as six on the wave gate.
- **Armor while armed.** The center takes `armorMult` (0.15) damage while any arm is attached. The fight is
  the arms; shooting the middle first is meant to be a waste.
- **Detach, then destroy.** An attached arm at 0 hp does not die: it detaches with a fresh pool of
  `armDetachedHp`, crawls away and starts `hatchTime` (7 s) on its hatch ring. Destroy it before the ring
  completes or it spawns another full Starfish at that spot. Detaching decrements the center's `armCount`
  and clears that arm's bit in `armMask`, which is what the center draws stumps from.
- **Hatchery cap.** `STARFISH.maxLive` (2) bounds how many centers can exist at once, so a player who
  ignores every arm cannot spiral the arena. An arm at the cap keeps its timer and retries rather than
  dying. Do not remove this cap without a pool/performance pass.
- **Mouth.** Once `armCount < 5`, the center cycles open → suck → chomp → recover on
  `mouth.cooldown` (4.5 s). The suck drags bodies toward the middle but never while they are dashing, so
  the dash is the escape; the chomp is a 100-unit AOE for 2. With all five arms gone the same cycle is
  faster and wider (`angry` block).
- **Armless phase.** `armCount === 0` speeds the spin to `angry.spin`, and the center sprays
  `angry.spineCount` (8) spines in a ring every `angry.spineInterval` (1.5 s). Attached arms also throw a
  three-spine fan every `spineInterval`; spines are hostile type-3 shots with `srcKind = SRC.WORM`, so they
  are dodgeable, deflectable and can hurt other threat factions.
- **Center death** clears every remaining arm body, so killing the middle ends the fight even with
  detached arms crawling. Do not leave orphaned arms with a dead group.
- **Rendering.** Arms are tapering curves with a whip and a curl-back, suckers down the length, and a stump
  when the bit is clear. The mouth is a ring of teeth whose opening tracks the suck state; the armless rim
  gets a hot rotating ring. A detached arm keeps the same curved arm silhouette and stump, with its hatch
  ring as an arc that fills toward a new boss. Palette: `#ff7ab8`, core: `#ffd6e8`.
- **Render mode.** `drawStarfish` and `drawStarfishArm` save the context and force `source-over`. The
  worm pool draws with `lighter`; under additive blending the dark mouth and overlapping arm fills read as
  holes and flash as the arms rotate. Do not remove either opt-out.
- **Opaque body (2026-11-02).** The arm fills, center disc and detached arm draw at full alpha with a
  brighter palette (`#ff9ecb` arms, `#8f2350` disc, `#c24c85` stumps). A translucent fill let the floor grid
  read through the silhouette and the boss sank into the background. Keep body fills at alpha 1; the
  position-interpolation `alpha` argument is not an opacity fade.
- **Tuning** is `STARFISH` in `tuning/threats.json`. `?starfish=1` is the QA boot hook beside `?mega=1`
  and `?hands=1`. `.tmp/starfish-check.ts` covers shape, armor, detach, destroy credit, hatchery, the live
  cap, the suck/chomp, and the armless spine ring. Re-run `.tmp/memory-check.ts` after touching the damage
  entry points, since arm and center damage both scale through `memoryDamage`.


### D70 — File Blob: icon count is the health bar (built 2026-11-02)

The fourth mini-boss is **FILE BLOB** (`MINIBOSS.BLOB = 3`, body `blob`, gauntlet wave 24, repeat every
48). A stack of file icons that chips away as you shoot it, then tosses a glob that glues you in place.

- **Scale and armor (2026-11-02).** The body is now roughly three times its old size: `rMax` 276,
  `rMin` 102. The same 96 logical files occupy fixed golden-angle slots from the center outward, sized
  against the full `BLOB.icons` roster and `BLOB.rMax`. A hit removes an outer slot without repacking or
  rotating the survivors, so the pile keeps its shape and reads as an opaque haystack. `drawBlob` forces
  `source-over`; the worm pool's `lighter` blend made the paper transparent. Do not shrink the plates back
  down or restore additive blending.

- **Icons are render-only.** `hp` *is* the live icon count (`BLOB.icons` 96); every point of damage removes
  one icon. Nothing per-icon is simulated or allocated: each icon's slot is a deterministic sine hash of
  its index, fixed to the full roster and `BLOB.rMax`; `hp` only decides how many slots draw. Do not add an
  icon entity array, reintroduce per-hit repacking, or rotate the slots with `st.clock`.
- **Opaque backing (2026-11-02).** The hull is a solid `#1d4a60` fill with a bright `tint` rim, not a 0.16
  tint wash, and the paper/ink palette is brighter (`#f8fdff` / `#1a2833`). The old hull let the floor read
  through the pile, so the boss looked translucent. Keep the hull opaque; icons draw at full alpha.
- **Budget.** 96 logical icons, one draw pass, dropping with hp. Each glyph is one filled paper path, one
  fold triangle and three bars — about ten canvas ops, so roughly 1k ops a frame. This deliberately replaces
  the old 3-shell + core stack (about 3.1k ops), which was heavy enough to hitch the render step. The
  silhouette shrinks with hp, so density and icon count fall together and the blob never looks like a full
  stack at low health.
- **Skeleton.** The rim is `BLOB.nodes` (10) radial springs (`nodeR`, `nodeV`), each settling toward
  `blobRadius(w) ± 5%` wobble. The renderer draws a closed curve through them; icon slots stay fixed at
  `BLOB.rMax`, so damage deforms and shrinks the hull without shuffling the surviving files. Damage kicks
  the node velocities along the hit direction, which is the whole "squash" response.
- **Attack.** A faster chase (speed 58), contact damage on a cooldown, and two committed attacks. A lobbed
  glob has a 0.7 s windup, a 0.9 s arc, then a 122-unit AOE that deals 1 and applies the glue cage. A
  close-range **high jump slam** has a 0.45 s crouch, a 0.68 s airborne arc with a 280-unit lift, then a
  190-unit AOE for 2 and 1400 knockback. Both landing points latch at the start of the tell, so moving is
  the answer. Slam recovery is 0.55 s and its cooldown is 2.8 s; the glob rearm is 2.6 s.
- **Glue is a root, not a web.** `Player.glueT` roots movement in `movement.ts`; it is deliberately not
  freed by a dash (unlike Fisher's web), and a landing cancels any dash the body was in. `glueHits` (3)
  is chipped by the single player projectile path (`spawnProjectile`) and `trySwing`, so shooting or
  swinging tears files off the cage instead of firing. Ghost's cloak (`cloakT`) clears it instantly;
  respawn clears it. Do not move the chip into a button handler — both entry points already cover every
  program's ranged and melee.
- **Rendering.** File glyph is an opaque folded-corner paper rectangle with three ink bars and a dark ink
  edge, tinted `#dfe9ef`/`#202a34`. Icons are drawn at the blob's world position, not at the local origin.
  A hit spawns a shed burst of up to ten files falling out of the rim. The glob in flight is nine files in
  a cluster, and the duct AOE is drawn as a ring at the latched landing point. A glued body shows seven
  files orbiting it, drawn from state in `drawGlueCages`.
- **Tuning** is `BLOB` in `tuning/threats.json`. `?blob=1` is the QA boot hook.
  `.tmp/blob-check.ts` covers icon health, shed, shrink, the high jump slam, the toss glue, the
  three-press escape, the Ghost phase and kill credit.

### D71 — Storm Cloud: the ceiling owns the fight (built 2026-11-02)

The fifth mini-boss is **STORM CLOUD** (`MINIBOSS.STORM_CLOUD = 4`, body `storm-cloud`, gauntlet wave 28,
repeat every 56). A boss-scale weather body that rains alternating rows under itself and throws a
telegraphed bolt. Everything it throws lives in the projectile pool, so guard, lash and player fire already
apply; nothing here is a second collision system.

- **One body, ceiling band.** It is a single worm-pool entry, `hitR` = `STORM_CLOUD.radius` (312, 3× the
  original 104) and `hp` 104, with `storm` state. It homes on `bounds.top + hoverTop` (±`hoverBob`), tracks
  the player only at `trackSpeed` (92), and slides away from a body inside `repelRadius` instead of hovering
  over it. It never dives to the floor: the top of the map is its ground, so a player cannot stand on or get
  above it. Contact damage is a cooldown-gated shove, not a chase.
- **Scale is a body change, not a rain change (2026-11-02).** `hoverTop` is negative (`-70`) so the enlarged
  body's **underside** sits where the old 104-radius body's did (`top + 242`). Rain and lightning spawn at
  `y + r + 8/10`, so holding the underside holds the rain origin, the cover rule and the lightning tell in
  place while the cloud itself triples in size. The y clamp is the `hoverTop ± hoverBob` band for the same
  reason; do not restore a `r * 0.3` floor, which would shove a 312-radius body 90 units down. `rain.width`
  widens to 520 and `rain.count` to 5 so the lane still sits under the pile; density, cycle, damage and the
  health pool are unchanged.
- **No arena clamp, and cover is real (2026-11-02).** The body is no longer clamped to the floor bounds:
  like the Mega Worm it may hang past the lip or leave the arena entirely, and `cullVoidThreats` skips it
  for the same reason it skips Idle Hands. Only the ceiling band holds it, because that band is its ground.
  Rain and lightning are ordinary hostile shots, so a pillar between the cloud and the floor eats both:
  standing under a block is shelter from the rain and the bolt, and that same block stops your return fire
  at the cloud. Keep the rain in the projectile pool; do not add a cover-free rain damage path.
- **Entrance (2026-11-02).** The storm opens like the staged bosses now: `STORM_CLOUD.introTime` (2.6 s) is
  routed through `beginBossIntro`, which also sets the body's `spawnT` to that duration. `drawStormCloud`
  reads `spawnT` as assembly progress, so square 0 snaps in alone and the other squares fly from scattered
  points, overlapping into the 84-square lattice with per-square delay, start point and grow. Do not put
  the whole-cloud scale back; the mass is meant to gather, not inflate. A direct spawn uses the same clock,
  so `?storm=1`, boss rush and the attract rotation all assemble too.
- **Rain is type 18.** A burst lays `rain.rows` rows of `rain.count` drops under the cloud, flipping
  direction each burst and offsetting every other row by half a gap. Drops fall at `rain.speed` and expire on
  their own fuse; they are hostile projectiles, so the existing player-bolt interception shoots them out of
  the sky, and guard/lash catches them. The barrage is deliberately longer than one guard: each catch burns
  guard energy, so holding shield through a burst breaks the shield rather than the rain.
- **Lightning is type 19.** One bolt on a `lightning.cooldown` clock, with a `windup` drawn as a flickering
  jagged line. The strike point follows the body for the first half of the tell, then latches so a dash or a
  step beats it. It deals `lightning.damage` (1) to a player and is the fight's real punish when returned:
  `Projectile.lightning` survives the `type >= 3` conversion on a catch, and a player-owned lightning shot
  deals `lightning.reflectDamage` (18) to any worm, which is about six clean returns for the kill. Do not
  fold that into the generic `BOLT.damage + deflects` rule, and do not drop the flag when a shot is caught.
- **Bots step out of the lane.** `BotBrain.avoidFurniture` pushes a body sideways when it is under a live
  storm within `rain.width / 2`, the same layer that handles emitter lanes, so both the duel pilot and the
  gauntlet `engageHostiles` pilot respect the rain. Without it every tier stood in the drizzle and died in
  ~14 s at roughly the same rate. Keep that steer when adding another ceiling threat; it is not a paint
  detail.
- **Measured curve (v0.1.141, `.tmp/storm-balance.ts`, 3 programs × 3 styles, 75 s cap).** HARD/digital:
  avg 34.1 s, 3/9 deaths, boss left at 31% average, one clean kill. Rookie: avg 38.5 s, 6/9 deaths, 58% left.
  That is the intended shape: a big boss that a good pilot can finish and an easy pilot usually cannot. If
  it needs another pass, move `rain.cycle`/`rain.count` first (density is the difficulty), then
  `lightning.cooldown`; leave `hp` alone unless the fight length itself is wrong.
- **Rendering.** The body is **84 opaque squares**: three loose 7×4 layers over the same lattice, each
  square jittered, sized `0.23–0.40r` from the fixed 84-entry `puff` array and rotated up to about half a
  radian so the grouping never reads as a grid. Source-over and a solid fill are load-bearing: the old pass
  used `lighter` at low alpha, so every overlap stacked into a brighter patch and the viewer could count
  the pile. Three layer shades carry the volume, a darker seam stroke keeps each square legible without
  becoming a glow, and a hashed elliptical envelope leaves the rim ragged rather than oval. An underside
  rain fringe, a jagged windup line and a strike flash follow. Drops are vector teardrops; bolts are jagged
  two-pass lances. No emoji, for the same palette reason as the Sweep broom.
- **Tuning** is `STORM_CLOUD` in `tuning/threats.json`; `?storm=1` is the QA boot hook. `.tmp/storm-check.ts`
  covers shape, the ceiling band, row emission, shooting a drop down, the reflect payoff and kill credit;
  `.tmp/storm-balance.ts` is the bot tuning harness.

### D72 — BOSS RUSH: the mini-boss ladder (built 2026-11-02)

BOSS RUSH is a gauntlet-mode ladder: no wave ramp, no fodder, one registered mini-boss at a time in
`BOSS_RUSH_ORDER` (registry order). It exists for boss testing, balance passes and performance tuning, and
as a playable local mode.

- **Entry.** `SINGLE PLAYER > GAUNTLET` setup has a `BOSS RUSH` mode toggle; the local multiplayer stage has
  the same toggle, which turns that lobby into same-screen co-op on the ladder. Online rooms stay
  versus-only: mini-boss bodies are not in `Snapshot`, so networking them is a protocol decision, not a
  menu row. Do not fake a guest-side boss.
- **Runtime.** `World.bossRush` (trailing constructor flag) makes `updateGauntlet` hand its clock to
  `updateBossRush`, before the network fixtures, boss wave gates and every family timer. Spawning still goes
  through `spawnMiniboss`, so entrance beats, camera cues and pools are the ones the gauntlet already uses.
  `BOSS_RUSH.firstDelay` and `.gap` are the only new timings.
- **Advance and clear.** A boss is down when `minibossLiveCount(kind)` reaches zero; leftover parts of that
  kind (Starfish arms, a split hand) are retired so they cannot leak into the next fight as a second boss.
  After the last ladder entry, `bossRushCleared` and `gauntletOver` freeze the arena and the result plate
  reads `BOSS RUSH // CLEAR` instead of the ring-broken copy. A rush never writes a gauntlet record.
- **Co-op.** `setupGauntlet` seats every active local player on the training spawn spread, and deaths
  respawn on the gauntlet timer instead of ending the run. That respawn rule is also what makes the mode
  usable for tuning; keep the scored-gauntlet one-life branch gated on `!bossRush`.
- **No fodder.** Arena replicators and every threat family timer are skipped. Do not re-enable ambient
  spawns in a rush: a stray sentry or worm changes what a boss measurement means.
- **QA.** `?bossrush=1` boots the solo ladder immediately. `.tmp/bossrush-check.ts` covers ladder order,
  zero fodder, the inter-boss gap, clear state, co-op seating/respawn and that a scored gauntlet still ends
  on a death.


## TEST RANGE sandbox

`TEST RANGE` (`ARENAS` id 90, `qa: true`) is a deliberately huge, empty arena: 3480x1920, no pillars,
fixtures, voids or hazards, eight perimeter spawns. It exists so a boss or a kit can be read before
geometry collision and spawn placement get a vote. `?range=1` boots a gauntlet run there (`&bot=1` adds
the autopilot, `&mega=1` spawns the Mega Worm). It is filtered from the arena picker and is not selected
by normal play; do not ship it as a menu arena or a campaign node.


## Demo boss rotation

Both the idle attract demo and the permanent `?demo=1` kiosk boot run through `startAttract`, so the boss
rotation lives there and not in a second demo path. Sessions alternate: an ordinary seeded wave run, then a
boss showcase, repeating. The showcase cycles the five registry mini-bosses (`ATTRACT_BOSSES`) in order,
seeds a low `ATTRACT.bossWave` so the boss is the read rather than one silhouette in a wave-72 crowd, and
spawns the boss across the room from the squad through `spawnMiniboss`. QA arenas (`qa: true`) are excluded
from every attract arena pool, and a boss session requires at least 1500 units of width so the scaled Mega
Worm has room. Do not spawn demo bosses from the wave gate as well; that would double the showcase.
For reviewing the whole registry in one sitting, `?demo=1&boss=1` (or `?boss=1`) forces a boss into
every session instead of every other one, and holds every showcase on the `qa` TEST RANGE so scale,
movement and camera framing are judged without arena cover. It is a QA boot hook, not a player-facing
mode; ordinary attract never selects a `qa` arena.
A showcase session ends shortly after its boss dies; do not leave the kiosk in wave cleanup after the
boss is already dead. The camera frames the boss head with `CAMERA.bossZoomMin`; the Mega Worm's chain is
longer than the pane at combat scale, so its head is the subject and the tail may leave the frame. The
Mega Worm floats above the floor: it ignores cover for movement, chain, bite and acid, and its plates are
not clamped to the arena bounds. Ordinary worms stay cover-bound.
A boss arrival plays a one-shot entrance rig: the camera pulls back to `CAMERA.bossIntroZoom` on the
center of the assembled boss (head-to-tail midpoint for the Mega Worm) and holds, then blends into combat
framing. The boss-present floor is a separate `CAMERA.bossZoomMin`, shallower than the entrance and deeper
than a player-only fight. Do not reuse the entrance zoom as the combat floor; the entrance is a reveal,
the fight needs the squad readable.
While the entrance rig is the winning rig, the fit clamp must use the entrance floor instead of the combat
floor, or the reveal's pull-back is cancelled on wide arenas.

### Mega Worm pass cycle and announcement (decided 2026-11-03)

The Mega Worm's flyby is a **fixed pattern**, not an orbit: one straight run along the line latched through the last
detected position, a short run clear of the floor, then the body parks offscreen, assembles, and comes back on a
fresh line. Approaches fan by golden angle, so the lane alternates but the rule never changes. Passing speed ramps
with missing health (`MEGA_WORM.flyby.rageSpeed`), which is the only escalation: do not add new attacks to make the
last third harder. Keep the return offscreen (`stageMegaPass`) rather than restoring the wide outside turn; the turn
was what made the pass unreadable.

The arrival is **announced before it spawns**. When the run-up kills are met, Script Kitty warns, the
`SOMETHING BIG / MEGA WORM // INBOUND` card plays, and the body waits out `CAMPAIGN.bossWarnTime` before spawning on
top of its own entrance arc. That window is presentation only: it must never gate the quota, the arena, the clear
rule or `Snapshot`, and the line is the same local DOM story box as every other beat. `.tmp/boss-warning-check.ts`
owns this contract; `.tmp/campaign2-check.ts` owns boss mechanics but runs the pilot at `iframes = 999`, so it is not
evidence that the fight is survivable.

### Bots must read a boss pass (decided 2026-11-03)

`BotBrain.engageHostiles` now hands the last word to `megaLaneRead`: a moving mini-boss draws a straight line, so the
pilot abandons the corridor that line sweeps (heading and position only, nothing hidden) and dashes when the body is
close. Keep the corridor wide — the head is 138 across and the plates 99 — and keep boss standoff at 330 rather than
the 150 used for fodder, because 150 from a 138-radius head is standing inside it. A boss body must never be lashed
or rooted into with a heavy whose reach is smaller than the body. This is how a human plays the fight; do not replace
it with damage reduction on the boss.

### Pilot resource discipline against a mini-boss (decided 2026-11-03)

`megaLaneRead` spends a dash when the latched line crosses the pilot's station in under a second, paced by
`laneDashT` to one charge per pass, and covers the whole visible body: 1400 ahead and 2400 behind, because the chain
trails thirteen plates and hurts as much as the head. At one segment the pilot breaks off for a drawn
`RESTORE_STATUS` drop instead of trading. These read only what the player sees — heading, position, health, pickups,
cooldowns. Do not close the last gap by weakening the boss; the remaining deaths are fodder contact in the crowded
assault.

### Boss escape must run on every frame (decided 2026-11-03)

`BotBrain.think()` returns early in several branches (near-wall, guard hold, projectile reflex, and a dozen branches
inside `engageHostiles`). A boss escape called from inside `engageHostiles` therefore only ran on frames where nothing
else happened, which is never the frame a 940+ u/s body arrives: attribution showed every fatal hit at the head's own
contact radius with dash charges unspent. `bossEscape()` (close-body dash, then `megaLaneRead`) is now called on all
four `think()` exits and must stay there. A latched pass always crosses the station the pilot held, so the read buys
lateral distance early (2600 look-ahead, 520 corridor) rather than reacting to contact.

### Mini-boss assault model: ring, park, shooter, escape (decided 2026-11-03)

`BotBrain.fightBoss` owns boss nodes, ahead of the generic engagement. While the body travels the pilot holds a
620 ring around the head and stays out of the chain's 320 corridor; it closes to bolt range only while the body is
parked, engages a live sentry inside 470 from outside its firing band, dashes when anything is already inside its
reach, and takes a drawn RESTORE at two segments. The old close-hold engagement is what lost the fight. Two failure
modes remain and must not be papered over: the launch still catches the pilot at bolt range for ~155-unit head
contact, and a sentry beyond 470 still lands ~220-unit fire. Do not weaken the boss to close them.
