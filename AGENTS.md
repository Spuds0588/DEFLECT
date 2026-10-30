# AGENTS.md — DEFLECT operating contract

Read this first. It is the binding working agreement for anyone (human or agent) changing this repo.
`PRD-Deflect_game.md` holds the original design spec; this file records **how we build it** and where we
intentionally diverge from that spec.

---

## 1. Documentation workflow (do not skip)

Three files keep us from re-litigating decisions or rebuilding old work:

| File | Role | Rule |
| --- | --- | --- |
| `AGENTS.md` | Living architecture + decisions | Update when an invariant, system, or decision changes. |
| `TODO.md` | Forward plan | Mark tasks as they land. Never delete a completed item without a HISTORY entry explaining it. |
| `HISTORY.md` | Append-only session log | Add an entry at the end of every work session: date, goal, changes, verification, next. Newest at the bottom. |

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

Consequences that are part of the design, not bugs:

- Swinging **locks facing** for the whole swing. You cannot sweep the racket.
- Swinging slows movement to 55%. A whiff then adds lag; a hit recovers faster.
- You must face a threat by moving toward it, which puts you in danger.
- Dash direction is the **last nonzero movement direction**, not facing. Target lock can hold facing on
  an enemy while you strafe; dashing then goes sideways, not at the target.
- Target lock (`LT`) holds facing only. It never grants a second aim stick, and the beam still sweeps
  at `PLAYER.laserTurnRate`. `RB` and right-stick left/right step the held lock around the available
  targets while `LT` stays down; that is target selection, not aim.

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
outline is split into three health segments; a hit drops that segment to a faint ghost, so the silhouette
stays whole and low health still reads at a glance. Do not hide lost segments entirely. Bots and remote
players keep the silhouette and glyph but draw no health segments, heading arrow, energy arc or readiness
column; their action effects still render.
Enemy and bot damage visuals are undecided, so do not add health pips back until that pass happens.

Offline play identifies by **program**, not by slot. Each program owns a hue (`PROGRAM_COLORS`) and a
silhouette from `pathProgramHealth` in `src/game/identity.ts`: Probe is a cyan scan ring with `◎`, Wedge
an amber diamond with `▣`, Fisher an indigo hex reel with `≈`. The select screen and the arena share that
shape and glyph, so a program reads the same in the roster, intro and fight.A program's `glyph` may be a single character, a multi-character text combo, Unicode dingbats/wingdings, or a multi-line ASCII picture; `drawSymbol` scales it to the core and portrait, strips common indentation, and measures the real advance against the symbol font stack (`ui-monospace` first, then `Segoe UI Symbol`, `Noto Sans Symbols 2`, `Apple Symbols`, Wingdings, Webdings) so a wide mark shrinks instead of spilling through the hull. Prefer direction-neutral marks: a pointing glyph at the core reads as facing. Each program also owns `coreScale` so a tight hull keeps clearance from its
rotating health segments: Probe `1.12`, Wedge `0.88` (the diamond's sides are the tightest core), Fisher
`1.10`. The low-health core keeps a scale floor (`0.78 + 0.22 * coreHp`) so the mark stays visible while
the hull ghosts carry the damage read. Check a new program at full and one-segment health; the mark must
not touch the bright hull.

A four-sided hull cannot be split into three equal corner pieces, so Wedge draws one bracket per health
segment at three corners, a short frame-weight tab at the fourth corner, and a thin rim around the square.
The tab and rim keep the silhouette closed at full health without counting as a health segment; keep them
below the health stroke weight. Do not revert to equal perimeter slices on the diamond, which cut through
corners and read as arbitrary chunks. Networked matches still use the slot palette and slot glyphs because the
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
(accepted v1 latency).

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
style may not hold outside the distance its own bolt can reach. Bots scale engagement range by program
and commit to program heavies on a cooldown by holding the power button. Wedge bots turn away from a
threat to plant the wall between it and themselves, and place one while reloading; Fisher bots drop the
lure before disengaging and ignore their own beacon when looking for a decoy. Training and VS BOTS keep
separate difficulty preferences.

`?autoplay=N` is a QA-only boot hook: it starts a VS BOTS match with bots in every slot, including
slot 0, and auto-rematches when the match ends. It must stay out of menus and snapshots.

Bot movement around cover uses a precomputed 20-unit occupancy grid per arena plus one reusable A*
workspace (`src/game/nav.ts`). Routes are planned on a timer or when the target moves, then shortcut by
line of sight. All path buffers are preallocated per brain; do not allocate or run a full-grid search
every tick. Do not move pathfinding into `World.step`.

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

### D9 — Gauntlet is a local threat sandbox (revised 2026-10-29)
On explicit designer request, hostiles exist in a local **GAUNTLET** mode, not in ranked PvP and not over
the network. It is a test bed for the eventual PvE direction, not a promise of online PvE.

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
  should pass through geometry.
- **Viruses** are magenta diamonds that spread, split, and infect. They roam toward `VIRUS.roam*` points
  and only pursue a player or an uninfected worm inside `VIRUS.huntRadius` / `VIRUS.wormHuntRadius`; worms
  are the preferred host. They can convert a worm (magenta, faster) or fill the local player's infection
  meter; at full meter the meter resets to 0.3 and a **thrall** copy spawns nearby. A thrall writes an
  `InputFrame` like any player, so it obeys one-stick facing, swing locks, dash cooldown, burst recharge
  and energy. It uses `players[1]` locally, not a room slot.
- **Firewalls** are sweeping orange beams. They warn, then cross the arena and burn players, worms and
  viruses. Pillars cut both the visible beam and its damage; line of sight is real cover. Automatic
  firewalls are **off**. They are reserved for a future destructible switch on selected arenas; setting
  `GAUNTLET.autoFirewalls` back to true is the only way they appear in the sandbox today.
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
  bouncing.
- Enemy fire is factional. A missed sentry shot can damage worms, viruses, and cascading errors. Sentries
  do not shoot their own pack because a projectile has no source silhouette to exclude safely.
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
- The mode is deliberately absent from `Snapshot` and `NetView`. Any future networked PvE needs its own
  protocol work and a new decision; do not leak gauntlet entities into match snapshots.
- All numbers live in `GAUNTLET`, `WORM`, `VIRUS`, `FIREWALL`, `SENTRY`, `CASCADING_ERROR` and `THRALL` in
  `config.ts`.

### D10 — Four action jobs: ranged, melee, power, skill (revised 2026-10-29)
Player-facing names are plain words, not internal verbs: **RANGED ATTACK** (`X`), **MELEE ATTACK**
(tap `B`), **GUARD** (hold `B`), **POWER ATTACK** (hold `Y`), **SKILL** (tap `Y`), **DASH** (`A`). Use
those names in the settings screen and README. Internals may keep `swing`, `bolt`, `laser` and `bugKind`
(`bug` is the step-based sprite idea, not the action name). The buttons are jobs, not two versions of one
bolt:

- **Ranged attack (`X`)**: Probe's fast burst bolt is five shots, 0.45 s life (~390 units), one bank,
  1 damage, then a 0.2 s recharge. Holding keeps the stream coming at `BOLT.autoInterval`; the low shot
  cost makes sustained fire possible without turning it into a machine gun. Wedge fires a three-shot
  string and Fisher a piercing spear. Do not restore the old long TTL without reworking the kit.
- **Melee attack (`B` tap)**: the cone is **180°**. Every quick press is a fast spiked lash that sweeps
  the arc left, right, left. It reflects incoming fire and shoves players and hostiles sideways in the
  sweep direction; there is no third-tap shield wave. Facing locks for the lash. The active window is
  generous; an early or far-edge catch still returns the bolt, but angles it and loses some speed. A
  last-instant catch returns it straight.
- **Guard (`B` hold)**: after `PLAYER.guardStartDelay` (0.08 s) the melee button raises a 180° shield
  that reflects every shot in front for up to 1 s instead. A quick tap stays a melee attack and never
  draws shield fill. Each caught shot burns `guardReflectCost`; when the guard or its timer runs out it
  enters a 0.28 s cooldown. Releasing early drops the shield into a 0.12 s release lockout. If target
  lock is holding facing, caught shots flatten toward the locked target instead of following the
  incoming angle. The shield visual is one clean crescent: fill, rim and burn-down edge, with no radial
  fan and no cooldown ghost arc beside the avatar.
- **Skill (`Y` tap)**: the program's assigned skill, owned by `PROGRAMS` (`bugKind` is the wire field):
  Probe's proximity mine, Wedge's **static wall**, Fisher's lure beacon. Wedge plants his bracket shape as
  a solid barrier one body-length behind him (`WEDGE.wall*`): it blocks bodies and reflects shots, so it
  closes the lane he just left and pairs with a backward dash and a flip. It is not a shove and not a free
  projectile delete; dodge still phases through it. A wall that would land in cover is refused and the
  energy is handed back. Legacy kinds `1` trap, `2` wall shield and `3` ghost remain implemented
  prototypes for future programs; do not expose them as a random roll again. The host owns each player's
  skill; guests read it from the snapshot.
- **Power attack (`Y` hold)**: program-specific heavy. Probe charges for 0.9 s, then **auto-fires**
  without waiting for release for 3 s, rooted, sweeping at `PLAYER.laserTurnRate` (0.55 rad/s), piercing
  every enemy in the line and respecting pillar cover. Wedge plows forward with a bracket; Fisher draws a
  **freeform web**. Cooldown starts when the heavy ends. Releasing before the charge completes cancels;
  a release inside `heavyTapMax` uses the skill instead.
- **Dash**: two stored charges (`PLAYER.dashCharges`), one shared 1.8 s recharge. Tap phases through
  geometry and enemies; hold after the tap for the charged triangle dash that damages what it crosses.

Health is three segments on the local avatar's program outline (`PLAYER.hp`). One ordinary hit removes
one segment. Do not add a separate health bar beside the avatar; the outline is the local readout.
Remotes do not show segments until enemy/bot health visuals are designed.

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
- `OVERCHARGE` makes ranged fire an instant-on/off beam, triples dash distance, and replaces the core
  symbol with a lightning bolt while active.
- `BARBED WHIP` replaces the melee lash and guard with a red lash and multiplies reflect reach and
  damage by four.
- `PATHFIND` turns ranged bolts into axis-aligned seekers that turn at right angles toward the nearest
  target.

Timed effects last 11–15 s and replace each other rather than stacking. Active icons float behind the
avatar; no separate powerup bar.

### D11 — Avatar-only telemetry and settings sub-menus (decided 2026-10-28)
The canvas shows no operator name plates or life bars. Health is the rotating segmented outline around
the **local** avatar; energy is the local inner arc. Ranged ammo, dash charges, the skill and
power-attack marks, and the current pickup sit in one compact **top-left readiness dock**: a dark panel
with five icon cells and cooldown rings, no labels. It is local-only; remotes show no health, energy,
heading arrow or readiness marks. Match state (round, timer, score pips) stays in the bottom strip. The
optional minimap keeps the lower-left corner.

The DOM settings screen is tabbed: `FEEDBACK`, `AUDIO`, `SYSTEM`. Persisted options are
callsign, hit rotation, impact flash, scanlines, minimap, master volume, soundtrack, SFX, menu sounds,
mute, and arena/bot preferences. New feedback options belong in the Feedback tab, not beside the title
menu. The minimap is a small edge-anchored lower-left overlay showing cover and every local threat
family; it is off only by explicit player choice.

`HOW TO PLAY` is a top-level title option and the only home for control and kit explanations. It detects
connected gamepads and draws either a gamepad table or a keyboard/mouse table; the pad name may appear in
that screen's header. It carries a short rules section, the program roster and clip tiles that are
placeholders until recorded gameplay clips exist. Keep the explanation here rather than in the other
menu stages: title menus list options, not instructions.

The title is a single console menu, not a dashboard: plain text options, one `>` cursor on the focused
line, no grid backdrop, and no footer links. The ASCII logo header belongs to the hub only; every
sub-stage hides it (`stage-open` on `#screen-title`) so the reclaimed height goes to the stage content.
The hub is `SINGLE PLAYER`, `MULTIPLAYER`, `HOW TO PLAY`, `SETTINGS`; callsign editing lives in
`SETTINGS > SYSTEM`. The Multiplayer stage has exactly two modes: **ONLINE** (host game or join game) and
**LOCAL** (same screen, not built yet). Local lists `ARENA` and `GAUNTLET` as placeholders that report they
are not wired; it must not grow a fake player/device setup before local slots exist. Public room discovery
is planned around a shared prefix on the 4-character code: a public game opts into the prefix, a private
game keeps an unprefixed code. Do not add that search UI before the local mode is built. The campaign
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

Local readiness marks live in one fixed **top-left readiness dock**, out of the avatar/enemy space:
ranged ammo, dash charges, skill, power attack, then the active pickup. It is icon-only, local-only, and
uses cooldown rings rather than text or bars. Give each program's skill and heavy distinct marks; they
share the dock and must not be mistaken for each other. The dock hides while the local avatar is dead.

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
stylesheet.

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
  completed level. Slots are local only, never enter `Snapshot`, and nothing writes one until the first
  playable sector exists. Do not turn this stage into a sector-select screen. The blueprint archive is
  parked and unlinked while this flow is built; do not reattach it to the campaign stage without a
  decision.
- The campaign route plate (`road.ts`) belongs to the between-level transition, not to the archive. Do not
  mount it in a menu.

### D14 — Sweep.exe is parked until its kit exists (decided 2026-10-29)
`SWEEP.EXE` is designed but deliberately **not** in `PROGRAMS` yet. Its identity is an ASCII broom and a
lime accent; its kit is a three-hit broom combo for melee, a dust-trailing broom throw for ranged, a huge
broom drawn line by line then swept down the top two thirds of the screen for the power attack, and two
brooms that split outward to clear a lane for the skill. Do not add a selectable card until those
branches exist in `World`; a card running another program's attacks is worse than no card. Reuse the
Wedge displacement slide and square dust rather than adding a second knockback system, and check the core
mark against the hull at full and one-segment health. The full spec is in `TODO.md`.

---

## 3. Architecture

```
index.html            DOM screens (title, settings, lobby, overlays), canvas mount
styles.css            UI system (neon geometry, no external fonts/images)
src/main.ts           app state machine: title → lobby → game; UI wiring; gamepad menu nav
.github/workflows/pages.yml  build dist and deploy the main-branch alpha to GitHub Pages
src/game/config.ts    ALL tuning numbers. Change feel here, not in systems.
src/game/programs.ts  roster: program ids, names, hues, core glyphs, signature skills
src/game/road.ts      campaign route plate for the between-level transition (parked, not mounted)
src/game/arenas.ts    five arena layouts (MAINFRAME is multi-district), spawn rings, previews
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
src/game/render.ts    canvas renderer, camera shake, HUD, in-world FX
src/game/particles.ts pooled particle system
src/net/net.ts        PeerJS host/guest sessions, snapshot interpolation
src/ui/dom.ts         small DOM helpers / screen manager
scripts/gen-icons.mjs PWA icon generator (pure Node, zlib PNG encoder, no deps)
scripts/bench.ts      headless simulation benchmark (ms per 60 Hz tick)
CAMPAIGN.md           campaign topology, map handoff and open rules decisions
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
- The active `ArenaDef` supplies pillars and ordered spawn points. Any player count spreads evenly
  around that arena's spawn ring; the training drone uses the opposite spawn.
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
- Laser damage is tested against the full worm chain, not just the head. Wall shields absorb projectiles
  from other players; ghost ignores contact/projectile damage and ends on any attack.
- Hit detection is substepped (max 6 units per substep) so 2800 u/s bolts cannot tunnel.
- Program kits are data in `programs.ts` plus branches in `World`. Probe keeps the five-shot burst,
  charged piercing beam and proximity mine; Wedge fires a three-shot string, dashes with a damaging
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

- Single canvas, DPR-aware, letterboxed to 16:9, integer-ish scale. `MAINFRAME` is larger than one
  viewport and uses a follow camera with a small dead zone.
- Dark background, grid, arena frame, corner brackets, and the active arena's pillars.
- Each arena supplies an accent and a floor signature (cross, square, rings, chevrons). The title
  picker draws the same geometry into small preview canvases; no separate art path.
- All glow is multi-pass stroke + `globalCompositeOperation = 'lighter'`. **Never** use `shadowBlur`.
- Trails are drawn from a small ring buffer per projectile. Gradients are built on resize only.
- HUD is canvas-drawn. Health is the avatar's rotating three-segment outer silhouette; energy is the
  inner arc. Ranged ammo, dash charges, the skill mark, the power-attack mark and the active powerup sit
  in one compact top-left readiness dock: a dark panel, five icon cells, cooldown rings, no text. There
  are no operator chips, name plates, side bars or per-player corner bars. Health, energy, heading and
  readiness belong to the local player only. Round/timer/score pips live in the bottom strip. Permanent
  in-match text is suppressed; only short wave banners and the DOM pause/round/match overlays carry
  words. Label strings are cached. Blueprint canvases size their backing store from the CSS box at device pixel
ratio (`fitCanvas` in `src/ui/dom.ts`) and draw in a fixed design space, so map labels stay at the console
text scale instead of being baked into a small bitmap.
- Cover is a solid object: bright panel fill, inset panel, hard rim and top highlight. It must not read as
  floor texture. The lower-left minimap is optional and reuses the same arena geometry.
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
  mix. Nothing loaded from disk.

---

## 4. Controls

| Action | Gamepad (preferred) | Keyboard/mouse |
| --- | --- | --- |
| Move + face | Left stick | `WASD` / arrows |
| Melee attack / guard | `B` | Left mouse / `J` |
| Ranged attack | `X` | Right mouse / `K` |
| Power attack (hold) / skill (tap) | `Y` | `E` / `L` / middle mouse |
| Lock target | `LT` | `Q` |
| Cycle lock target (hold `LT`) | `RB` / right stick left-right | — |
| Dash / charged dash | `A` / `L3` | `Shift` / `Space` |
| Menu confirm | `A` / `Start` | `Enter` / focused button + `Space` |
| Menu move | D-pad / left stick | Arrows |
| Menu back | `B` | `Escape` |
| Open in-game menu | `Start` / `View` | `Escape` |
| Mute | — | `M` |
| Perf HUD | — | `F3` |

`B` is the deflect button in-game, so only `Start`/`View` opens the in-game menu while playing. `B`
closes an open overlay (menu back). Settings are a top-level title option; the gamepad navigates the
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

- Every gameplay number lives in `src/game/config.ts` and is exported. No magic numbers in `world.ts`.
- A feel change must state the old value, new value, and why in `HISTORY.md`.
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

## 8. Performance guardrails

- Sim target: **< 4 ms** per 60 Hz tick with 8 players and 48 live projectiles on a mid-range laptop.
  Run `npm run bench` after touching the sim. The bench also runs an eight-bot digital swarm
  (AI + sim) so the local bot path cannot regress unnoticed.
- Render target: 144 FPS on integrated graphics. No `shadowBlur`, no `filter`, no gradients per frame,
  no `createPattern` per frame.
- Snapshot budget: keep 8P/48 projectiles at or below ~3 KB. Last measured v0.1.2: 2.88 KB. v0.1.4 adds
  lock and bug fields to every player row, so those sizes must be remeasured before quoting a new cap.
  Use binarypack arrays only; delta compression is deferred until a real playtest shows bandwidth trouble.
- Verify player cap with `F3` (frame time, sim time, projectile count) and the bench scenario
  (`?stress=8` spawns eight simulated players in training).
- Bot cost is part of the bench result; do not move AI into `World.step` or allocate per bot per frame.
  A* scratch must stay preallocated (`src/game/nav.ts`); re-plan on a timer, not every tick.
- The gauntlet max case (2 worms, 10 viruses, 2 firewalls, 14 cascading-error blocks, sentries, one
  thrall) is part of `npm run bench`. v0.1.15 measured 0.131 ms/tick avg, p99 0.522 ms with 26.2 live
  threats. Keep it there so threat complexity cannot regress silently.
- Measured results live in `TODO.md` §Performance. Do not claim a cap without numbers there.

---

## 9. Verification

```bash
npm install
npm run build      # tsc --noEmit && vite build
npm run bench      # headless sim benchmark
npm run dev        # manual playtest
```

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
packaging, self-hosted networking, mobile touch controls, replays. Local test bots (`src/game/bot.ts`)
and the local GAUNTLET sandbox (`World` gauntlet mode) are in scope; they do not change this list into a
promise of online bots or networked PvE.

The core PvP loop, PWA install, controller support, N-player rooms, and training must be solid first.
