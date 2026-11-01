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

`rooms`, `bridges` and `port` are tutorial presentation data, not a second traversal system. Rooms only
draw floor plates, labels and dressing; the matching `traverse.chasms` are the body blockers and the
`traverse.bridges` are the walkable spans. A room arena stays local-only (`isOnlineArena` skips `rooms`)
and never enters host/guest room selection. See D41.

An arena may also carry a `traverse` record: chasms, bridge decks, upper-deck treatment, paired pads and
linked lift plates. Chasms are **body** blockers, not cover: `arenaSolids()` adds them to `pillars` for
bodies, bot pathing, spawns and placement, while projectiles and lasers keep using `pillars` alone and fly
over the gap. A dodge still phases solids, so a charged dash can cross a trench. Pads and lifts arm on a
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
  projectile delete; dodge still phases through it. A wall that would land in cover is refused and the
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
- **Dash**: two stored charges (`PLAYER.dashCharges`), one shared 1.8 s recharge. Tap phases through
  geometry and enemies; hold after the tap for the charged triangle dash that damages what it crosses.

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
  `GRID ZERO` is authored but parked with `playable: false` until the route continues; a completed BUILD
  ROOT slot reports `MORE LEVELS COMING SOON` instead of starting it.
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

`KEYPAD` (arena id 11) is a ten-key phone pad in the middle of a walled room. The layout in
`ArenaDef.keypad` is a 3×4 grid: digits 1–9 in the top three rows and a centered 0 on the bottom. The
ten caps cycle from a recessed socket to a warning lift, a downward slam, solid cover, and a rise. Every
key has a phase offset from `KEYPAD.offsetStep`, so the pad is a rolling pattern instead of ten caps
moving together. Timing, crush damage and offset live in `tuning/world.json` under `KEYPAD`.

- A cap is harmless while up or warning. On the first frame of `SLAM`, every body whose circle overlaps
the cap is crushed. Players take `KEYPAD.playerDamage` (3 segments); training drones, worms, viruses,
sentries and error blocks take `KEYPAD.threatDamage` (99), which deletes them through the normal damage
paths. This is deliberately lethal to threats, not a second combat system.
- `SLAM`, `DOWN` and `RISE` footprints are solid cover. They block players, local threats and projectiles;
the player is pushed out after the shared motion step, and a dash still phases them. A down cap also
blocks beams and line-of-sight reads, so it is true cover while it is on the floor.
- Key timing is **online-safe**: `Snapshot` carries the shared `keypadT` clock and every peer derives the
ten states with `keypadKeyState()`. The host still owns the crush; a guest mirrors HP and uses the solid
caps only for prediction. `onlineArenaIndex` no longer skips a keypad arena. Do not add per-key state rows
to the snapshot; the clock is the contract (D40).
- Bots steer around warning and down caps through the same furniture-avoidance path as bumpers. The
keypad must not add per-tick pathfinding or a second grid; the dynamic caps are not baked into `nav.ts`.
- The renderer draws the socket, warning bars, solid cap, digit and minimap footprint from the same
`World.keypadStates` array. Keep the digit readable in every state: the phone-pad silhouette is the
map's identity, not decoration.

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
`SCANNER.enemyDamage` (3) for worms, viruses, sentries and error blocks. A dash is airborne and phases
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

The compactor, keypad, scanner and browser arenas are **online-safe**. `Snapshot` index 13 carries one
compact hazard block, or `null` on a quiet floor:

`[pusherT, keypadT, scannerT, scannerPage, browserT, browserPage, props]`

`props` is `[index, kind, x, y, w, h, hp, hitFlash, dropT]` for each live file box. Six clocks/indices and
the live debris list are enough because every visible hazard is deterministic from the arena record:
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
  and a separate protocol decision (D27, D30). Do not treat the four clocks above as permission to add
  every fixture to the packet.
- Measured v0.1.88: the heaviest hazard block (7 live boxes on `RECYCLING BIN`) packed to **180 B**;
  clock-only maps packed to 16 B. At 30 Hz that is +5.4 KB/s per guest, or +37.8 KB/s of host upload with
  seven guests (about 6% of the measured 0.59 MiB/s host baseline at 8P/48 projectiles). A quiet arena pays
  one `null`.

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
  geometry. The painted worm and virus silhouettes wait behind the bars, and their real bodies spawn only
  on release.
- `CALIBRATION_SKILL_TUTORIAL` starts on wake and asks for the skill while wave 1 (the six subjects) is
  live. After the class is down and the skill beat is done, `beginCellRelease` removes the cell-block
  solid, flashes the bars, marks them open, spawns two viruses and a worm in the cells, and gives the
  player 1.2 s of iframes for the cut. `CALIBRATION_POWER_TUTORIAL` then asks for the heavy while wave 2
  is live. `campaignPhase === 'release'` updates only those viruses/worms; the gauntlet timers stay parked.
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
