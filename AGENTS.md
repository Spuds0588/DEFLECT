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
  at `PLAYER.laserTurnRate`.

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

### D4 — Identity: color ring + glyph (decided 2026-10-28)
Every avatar is a colored ring with a geometric glyph at its center. Slot assignment uses a curated
high-contrast neon palette plus a distinct glyph per slot (`src/game/identity.ts`). The ring is split into
three health segments; a hit removes a segment and leaves a visible gap so low health is readable at a
glance. This is deliberately team-ready: a future team mode paints the **ring** by team and keeps the
**glyph** unique per player. Do not add per-player customization UI in v1; customization is a later phase.

### D5 — Feedback is event-driven (decided 2026-10-28)
The host includes an `events` array in each snapshot: shoot, swing, deflect, bounce, explosion, hit, dash,
round start/end, win. Each event is `{ kind, slot, x, y, power, dirX, dirY }`; hit events carry the
knockback direction so every peer sprays directional sparks the same way. Peers use those events for
particles and sound so that everyone sees and hears the same thing. A guest plays its own **shoot /
swing / dash** sounds locally for immediacy; deflect and hit feedback come back with the snapshot
(accepted v1 latency).

### D6 — Training drone and local bot simulacrum (revised 2026-10-28)
Solo training includes one simple drone: it drifts, fires slow bolts, and respawns. It exists so the
designer can test feel without a second human; do not grow the drone into pathfinding or prediction.

Training has a second program: **endless bot practice**. The player picks 1–3 bots and a tier, and the
room runs in `World('training')` with no rounds or score. Every dead body, human or bot, respawns on the
training timer, so the session continues until the player leaves. The sparring drone is suppressed when
bots are present. Do not route this through the match round flow.

On explicit designer request, a separate **local bot match** also exists (`src/game/bot.ts`). Bots write
ordinary `InputFrame`s and are bound by the same single-stick facing, swing locks, dash cooldown and
energy costs as a human. There are three tiers (`ROOKIE`, `VETERAN`, `DIGITAL`) and three styles
(`DUELIST`, `TRICKSTER`, `SIEGE`). They are test opponents, not a future PvE system; do not give them
network authority or direct world mutation.

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

### D9 — Gauntlet is a local threat sandbox (decided 2026-10-28)
On explicit designer request, hostiles exist in an endless local **GAUNTLET** mode, not in ranked PvP and
not over the network. It is a test bed for the eventual PvE direction, not a promise of online PvE.

- Enter from the title screen. It runs `World('gauntlet')` with one human, respawns, and no round flow.
- **Worms** are red square chains that damage on touch, swallow projectiles and viruses, and grow a
  segment per meal. They always chase the local player and are **blocked by cover** like the player;
  only designated phasing threats should pass through geometry.
- **Viruses** are magenta diamonds that swarm, split, and infect. They can convert a worm (magenta,
  faster) or fill the local player's infection meter; at full meter the meter resets to 0.3 and a
  **thrall** copy spawns nearby. A thrall writes an `InputFrame` like any player, so it obeys one-stick
  facing, swing locks, dash cooldown, burst recharge and energy. It uses `players[1]` locally, not a room
  slot.
- **Firewalls** are sweeping orange beams. They warn, then cross the arena and burn players, worms and
  viruses. Pillars cut both the visible beam and its damage; line of sight is real cover. Automatic
  firewalls are **off**. They are reserved for a future destructible switch on selected arenas; setting
  `GAUNTLET.autoFirewalls` back to true is the only way they appear in the sandbox today.
- **Cascading errors** are yellow blocks with red exclamation marks. They spread outward block by block,
  damage on contact, and take three hits to delete one block. They are part of the threat pool, not
  arena geometry.
- **Sentries** are the shooting family: pulse squares, nested triplex shotguns, trapezoid homing pods
  whose missiles can be shot down or deflected, and three-dart flocks. They respect cover and line of
  sight. Packs are queued and drop one silhouette every `SENTRY.packStagger` seconds; never dump a whole
  firing squad into the room on one frame. Their low-tier bolts are short-lived and **disperse on
  geometry** instead of bouncing.
- Enemy fire is factional. A missed sentry shot can damage worms, viruses, and cascading errors. Sentries
  do not shoot their own pack because a projectile has no source silhouette to exclude safely.
- Every enemy assembles in over a short spawn window, holds still while its parts arrive, and de-rezzes
  into a size-scaled triangle burst on death.
- Waves escalate every 30 s: spawn intervals shrink toward a floor. The mode is a survive-as-long-as-you-
  can sandbox; there is no final win. Enemy health is deliberately low because the screen is meant to fill
  with targets; firewalls do extra damage to enemy factions (`FIREWALL.enemyDamage`).
- The mode is deliberately absent from `Snapshot` and `NetView`. Any future networked PvE needs its own
  protocol work and a new decision; do not leak gauntlet entities into match snapshots.
- All numbers live in `GAUNTLET`, `WORM`, `VIRUS`, `FIREWALL`, `SENTRY`, `CASCADING_ERROR` and `THRALL` in
  `config.ts`.

### D10 — Weak burst, random bug, charged beam (revised 2026-10-28)
The action buttons are jobs, not two versions of one bolt:

- **Weak (`X`)**: fast burst bolt, five shots, 0.45 s life (~390 units), one bank, 1 damage, then a
  0.2 s recharge. Holding the button keeps the stream coming at `BOLT.autoInterval`; the low shot cost
  makes sustained fire possible without turning it into a machine gun. Close-range pressure. Do not
  restore the old long TTL without reworking the kit.
- **Deflect (`B`)**: the cone is **180°**. Taps chain left, right, then a forward shield wave; each arc
  reflects. Holding for `PLAYER.guardStartDelay` (0.08 s) raises the guard: a 180° shield that reflects
  every shot in front for up to 1 s; a quick tap stays a tap.
  Each caught shot burns `guardReflectCost`; when the guard or its timer runs out it enters a 0.28 s
  cooldown. Releasing early drops the shield into a 0.12 s release lockout. If target lock is holding
  facing, caught shots flatten toward the locked target instead of following the incoming angle. The
  swing punches at close range. Facing locks for the swing. The tap active window is generous; an early
  or far-edge catch still returns the bolt, but angles it and loses some speed. A last-instant catch
  returns it straight.
- **Strong (`Y`), tap**: uses the player's **randomly assigned bug** for that match. Four kinds:
  `0` proximity mine, `1` slow trap, `2` frontal wall shield, `3` ghost (translucent, damage/aggro
  immune, cancelled by attacking). The host owns the roll; guests read it from the snapshot.
- **Strong (`Y`), hold**: charges a beam for 0.9 s, then **auto-fires** without waiting for release for
  3 s. The player is rooted for charge and fire, may sweep at `PLAYER.laserTurnRate` (0.55 rad/s), pierces
  every enemy in the line, and respects pillar cover. Cooldown starts when the beam ends. Releasing
  before the charge completes cancels; a release inside `heavyTapMax` uses the bug instead.
- **Dodge**: two stored charges (`PLAYER.dashCharges`), one shared 1.8 s recharge. Tap phases through
  geometry and enemies; hold after the tap for the charged triangle dash that damages what it crosses.

Health is three ring segments (`PLAYER.hp`). One ordinary hit removes one segment. Do not add a separate
health bar beside the ring; the ring is the readout.

### D12 — Pickups are local content, definitions are data (decided 2026-10-28)
Healing and timed powerups are a **local training/gauntlet** system for now. They do not enter the network
snapshot, PvP rooms, or the gauntlet→PvE promise. `src/game/powerups.ts` owns ids, labels, colors,
durations, weights, and the weighted roll; `World.updatePickups` owns placement, collection, and the
timer. To add content, add a definition and an effect branch, not a second pickup system.

- `RESTORE_STATUS` repairs the three ring segments and clears slow/infection once those exist.
- `MACHINE GUN` turns held weak fire into a low-damage spray.
- `SCATTER` replaces the burst with a short-range fan.
- `OVERCHARGE` makes weak fire an instant-on/off beam, triples dash distance, and replaces the core
  symbol with a lightning bolt while active.
- `BARBED WHIP` replaces the reflect animation with a red lash and multiplies reflect reach and damage
  by four.
- `PATHFIND` turns weak bolts into axis-aligned seekers that turn at right angles toward the nearest
  target.

Timed effects last 11–15 s and replace each other rather than stacking. Active icons float behind the
avatar; no separate powerup bar.

### D11 — Avatar-only telemetry and settings sub-menus (decided 2026-10-28)
The canvas shows no operator name plates, life bars, or cooldown bars pinned to a corner. Health is the
rotating segmented outer ring; energy is the inner arc; burst ammo, dash readiness, and the current bug
icon float behind the avatar. Match state (round, timer, score pips) stays in the bottom strip.

The DOM settings screen is tabbed: `CONTROLS`, `FEEDBACK`, `AUDIO`, `SYSTEM`. Persisted options are
callsign, hit rotation, impact flash, scanlines, minimap, master volume, soundtrack, SFX, menu sounds,
mute, and arena/bot preferences. New feedback options belong in the Feedback tab, not beside the title
menu. The minimap is a lower-left overlay showing cover and local threats; it is off only by explicit
player choice.

The title is a single console menu, not a dashboard: plain text options, one `>` cursor on the focused
line, no grid backdrop, and no footer links. `SETTINGS` is a top-level option; callsign editing lives in
`SETTINGS > SYSTEM`. `SECTORS // PVPvE` is only shown inside the Multiplayer stage, as an in-development
entry. The solo flow is staged and auto-advances: program (training/gauntlet) → arena with previews →
bot count → bot tier → start for training; a gauntlet arena choice starts immediately. Choosing an arena
advances to the next stage, choosing a bot count advances, and choosing a tier starts the run. Do not add
a NEXT/RUN confirmation step back. The arena grid navigates in all four directions; inside a card grid,
a direction move stays in the grid while a neighbour exists. In-game canvas text is suppressed except for
short wave banners and the Esc/overlay menus.

The level intro is assembly, not a loading screen: ground, frame, cover (dropping in), then player
skeletons and spin-up. Do not add a progress bar back into the intro.

Do not show the current input device anywhere in the UI. `Input` follows the most recently used device
(keyboard/mouse or gamepad) and switches on the next real input.

---

## 3. Architecture

```
index.html            DOM screens (title, settings, lobby, overlays), canvas mount
styles.css            UI system (neon geometry, no external fonts/images)
src/main.ts           app state machine: title → lobby → game; UI wiring; gamepad menu nav
.github/workflows/pages.yml  build dist and deploy the main-branch alpha to GitHub Pages
src/game/config.ts    ALL tuning numbers. Change feel here, not in systems.
src/game/arenas.ts    five arena layouts (MAINFRAME is multi-district), spawn rings, previews
src/game/nav.ts       per-arena 20u navigation grid + reusable A* workspace for bots
src/game/bot.ts       local bot brains: tiers, styles, same InputFrame as a human
src/game/powerups.ts  local pickup ids, labels, colors, durations and weighted roll
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
public/               manifest, generated icons, service worker
```

### Simulation model

- Fixed step **1/60 s**, accumulator in `main.ts`; render interpolation via `prevX/prevY` and alpha.
- Playfield: `1280×720` virtual space; playable rect inset by `ARENA_MARGIN`.
- Entities are preallocated and reused. Projectiles and particles use `active` flags and compaction-free
  iteration. **No allocation in `step()` or `draw()`** (no object/array literals, closures, or string
  concatenation per frame). Numbers only.
- Players live in `world.players` with a stable slot index. Slot 0 is the host.
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
- HUD is canvas-drawn. Health is the avatar's rotating three-segment outer ring; energy, dash charges,
  burst ammo, the random bug icon, and the active powerup icon cluster behind the avatar. There are no
  operator chips, name plates or side bars. Round/timer/score pips live in the bottom strip. Permanent
  in-match text is suppressed; only short wave banners and the DOM pause/round/match overlays carry
  words. Label strings are cached.
- Cover is a solid object: bright panel fill, inset panel, hard rim and top highlight. It must not read as
  floor texture. The lower-left minimap is optional and reuses the same arena geometry.
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
| Deflect / combo | `B` | Left mouse / `J` |
| Weak burst | `X` | Right mouse / `K` |
| Strong: bug tap / beam hold | `Y` | `E` / `L` / middle mouse |
| Lock target | `LT` | `Q` |
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

Arena and bot setup live on the title screen and flow in stages: `SINGLE PLAYER` → program (training or
gauntlet) → arena card with previews → bot count/tier for training. The host can cycle the arena in the
lobby; the choice reaches guests in `START`.

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
- The gauntlet max case (2 worms, 12 viruses, 2 firewalls, cascading-error blocks, sentries, one
  thrall) is part of `npm run bench`. v0.1.9 final measured 0.172 ms/tick avg, p99 0.573 ms with 31.1
  live threats. Keep it there so threat complexity cannot regress silently.
- Measured results live in `TODO.md` §Performance. Do not claim a cap without numbers there.

---

## 9. Verification

```bash
npm install
npm run build      # tsc --noEmit && vite build
npm run bench      # headless sim benchmark
npm run dev        # manual playtest
```

Manual pass after gameplay changes: training on each arena (move/face/deflect combo/held guard/two dodge
charges/five-shot stream/bug/charged beam), losing each health ring segment, endless training at each tier
and count, gauntlet on each arena (worm eat/chase, virus split/infection/thrall, sentry stagger and
friendly fire, cascading-error spread, no automatic firewalls),
settings tabs and option persistence, two browser tabs (create + join on a non-default arena), round end
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
