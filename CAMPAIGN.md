# CAMPAIGN // route blueprint

Status: `BUILD ROOT` is playable; the rest of the route is still blueprint. `REBOOT` is authored but
parked until the next segment ships.
`SINGLE PLAYER > CAMPAIGN` is the story-mode entry: three local save slots first, then for a new run a bot
count and player select. The run saves after every completed level via `src/game/saves.ts`; after the one
live level the slot reports `MORE LEVELS COMING SOON`.
Neither surface enters `World`, `Snapshot`, rooms, or the network. Any networked PvPvE run still needs its
own protocol work.

## Campaign spine: island hopping (decided 2026-11-02)

The run is a chain of **islands**: one network at a time. Each sector is an island — you land, you find the
infection that has taken it over, you clear every infection you can find there, and only then does the
route carry you to the next network. There is no sector select; the player is always either clearing the
island they are standing on or travelling to the next one.

The infection is the enemy's **footprint**, not the enemy itself. The objective of the whole campaign is to
**find and delete the big bad: a rogue AI agent that is behind the spread**. The islands are how the player
closes in on it. Clearing an island weakens the spread and earns the uplink; the final island is where the
agent itself is reachable and can be deleted.

This reframes the existing route without changing its geometry or its names:

- `LOCALHOST`, `OFFICE LAN`, `CINEVAULT`, `BOTNET` and `SINGULARITY` keep their sectors, arenas and crossing
  names. They are the islands.
- The route's `ROOT` stop inside `THE SUCCESSOR` is the agent's own system and stays the major encounter.
- An island's clear condition is its **infection count**, not a kill count for its own sake. The uplink that
  opens the next crossing is earned by clearing, so the objective strip and the sector exit share one gate.

Open questions this does not settle: whether the agent shows itself only on the final island or taunts the
player from earlier hops, whether an island may be left with infections alive (and how that reads as a
outcome), and how a cleared island is drawn on the route plate.

## Narrative spine (decided 2026-11-01, not built)

**Opening.** The campaign starts in the **quarantine section of a dev system**. Every player program — the
whole roster, including the ones that read as utilities — was pulled by antivirus and sent here to be
"retrained". The player is not picking a hero; they are picking which flagged program to run. That
retraining is the tutorial: it is where the run teaches movement, the four action jobs, guard/reflect and
dashing. The existing BUILD ROOT beats (calibration subjects, drill squad, breach, assault) are the
mechanics of the session; its fiction becomes the quarantine stop rather than a neutral sandbox.

The opening blockout is **QUARANTINE**: one arena made of a round **INTAKE** office, a square **HOLDING**
office with three jail cells, a rectangular **MAINBOARD**, and a larger **ROUTER** rectangle, linked by
three bridge decks. The holding floor is staffed by floating CRT-monitor ordinary programs (TICKET, PATCH and
CACHE); they are civilian dressing, not combatants, and are destroyed when the calibration class wakes.
script_kitty waits behind the middle cell bars. The Warden's basic lesson runs in the intake; the six
calibration subjects wake in holding as **wave 1** and carry the skill lesson. The sealed cell block is a
body solid while it is powered. Clearing all six and finishing the skill beat makes the block
fail: the bars retract unexpectedly and release **wave 2**, two viruses and a worm, for the power-attack
lesson. The bodies are already in the cells, frozen and untargetable while the block is powered; the
power-down wakes them instead of spawning replacements. Clear that wave and the heavy beat before the drill. The router is the visual approach to a
**NETWORK PORT**. The port is not a gate yet: BUILD ROOT still clears on the assault kill count. The
level is local-only and its room data never enters `Snapshot` (see AGENTS D41).

**Inciting incident.** The infection breaks out of quarantine and spreads through the dev system. The
friendly program gets the players out, and that escape carries the route through LOCALHOST and onto the
open web.

**Narration.** Story is delivered in **text boxes anchored to the bottom of the screen**, not in-world
bubbles or a separate dialogue stage. The speaker's head is a symbol (emoji, Unicode pictograph or
Wingdings glyph) that floats gently up and down while it is on screen, so a static mark reads alive. No
painted portraits, no voice-over, no lip flaps.

### Cast

| Role | Mark | Notes |
| --- | --- | --- |
| Quarantine officer (THE WARDEN) | 👮 | Runs the quarantine and the retraining. Authority voice: procedural, certain the flagged programs are malicious. **Decided 2026-11-01: this is THE WARDEN**, the same character as the LOCALHOST sector boss, not a separate program. He speaks through the opening, then the sector gate is his fight. |
| Friendly program | 🐱 | Helps the players out of quarantine and out of the dev system when the infection hits. Guide voice and the first ally; recurs along the route. |
| The rogue AI agent (final level) | 🧑‍💼 / 👥 | The big bad at `ROOT`: a rogue AI agent behind the spreading infection (decided 2026-11-02, see **Campaign spine**). One agent, not a family of threats; the campaign ends when it is deleted. How it presents on screen is still open — a single User reads as one owner, a group of Users reads as the system's operators — but it is one antagonist either way. |

The mark is the character's **head**, not a menu icon: draw it at portrait size beside the text box with a
small bob and at most a degree or two of tilt. Do not add these characters to `PROGRAMS`, give them hulls,
health, hitboxes or `InputFrame`s, or put them in `World`.

### Presentation constraints

- The bottom of the screen already carries the campaign objective strip (one pip per delete) and the match
  strip. The text box must sit above that strip or temporarily replace it while a line is open. Pick one
  before the first beat is built; two bottom layers will collide at 720p.
- The readiness dock owns the corners (top-left for a solo local, one per corner with more players). A text
  box must not grow into them.
- Emoji are usually **colour bitmaps**: `fillStyle` does not tint them, unlike the ASCII and Wingdings marks
  in `identity.ts`. Treat the emoji face as fixed art and carry the character's colour in the frame, name
  plate or line accent. Wingdings and most monochrome pictographs can be tinted; test the chosen marks on
  Windows, macOS, Linux and Android before committing.
- Reuse the existing symbol stack and the `hasSymbolFont` fallback check from D16. A missing family must
  fall back to a plain Unicode mark, never a blank box.
- Keep lines short: two lines at 1080p, three at most, with a clear advance prompt. A box that has to scroll
  is a cutscene, not a beat inside a fight.
- Narration is local-only like the rest of the campaign. It never enters `Snapshot`, `NetView` or a room
  packet, and it yields to the Esc menu, the level intro and the death overlay rather than stacking on
  them.

### Narration rules (decided 2026-11-01)

- **Live, never blocking.** Lines play over the running simulation. The box never pauses `World`, never
  dims the arena, and never takes movement or action input. A fight that starts mid-line keeps going.
- **Near-instant reveal.** Text appears in a very fast reveal, not a slow typewriter. Readability comes
  from short lines, not from watching characters land, and there is no per-character audio tick.
- **Skippable.** A line can be skipped, and a whole beat can be skipped. Skipping is the player's exit from
  the read, never a fail state.
- **A replay option, not a hidden key.** Campaign setup carries a persisted `STORY BEATS` toggle beside
  `FRIENDLY FIRE`, default play. Set to skip, it bypasses the beats entirely for that run, so a replay goes
  straight to play without dismissing each box. Persist it like `deflect.friendlyFire`; a resumed slot keeps
  the setting.
- **Narration is cosmetic.** A beat must never gate a spawn, unlock a door, or set a flag gameplay reads.
  That is what makes skipping safe at any moment and lets a skipped run play identically.
- **Skip must not steal a combat button.** The skip affordance is a visible chip on the box plus a
  non-combat key or a touch tap; do not bind it to ranged, melee, guard, power, skill or dash. The exact
  bind is still open.

### Open questions

1. One User or a group of Users at ROOT?
2. Does the cat travel with the party on the route plate, or only appear at scripted beats?
3. Exact skip/advance bind (keyboard, gamepad, touch) that stays clear of the action jobs.
4. Does THE WARDEN keep talking during the boss fight, or does his voice stop once the fight starts?

## One route, not a level select

The campaign is a single internet route through device clusters. Each sector is one cluster: a dev
sandbox, an office LAN, a home media network, a botnet, then the rival AI's data center. Bridges are the
network paths between devices. Pads are direct links between paired machines. A lift is the shared bus
inside one storage device. The route ends at `ROOT`, inside `THE SUCCESSOR`.

The route blueprint is a review tool. In play, a player should not choose a sector from a menu. They
push through the current cluster, find the uplink, and carry the route into the next system.

The traversal grammar is now playable geometry. `ArenaDef.traverse` holds trenches, bridge decks, paired
pads and linked lifts, and `TRANSIT` is the test arena that mixes all three. It is one continuous arena,
not a node link yet: the campaign loader still has to decide how a bridge, pad or lift cut opens the next
node. Nothing about this geometry enters `Snapshot`; the tests cover local play only.

## Where the archive lives

`SINGLE PLAYER > CAMPAIGN` opens three save slots. An empty slot starts a new run and continues to the bot
count (`NO BOTS` to 3, saved as `deflect.campaignBots`) and player select; bots take the programs the
players leave unused. A filled slot resumes the run stored there and skips both steps. Slots show the
level and player count. The first two nodes are playable; the blueprint archive remains parked until the flow is
wired.

The illustrated route plate (`src/game/road.ts`) is built for the **between-level transition**: one wide
picture of the whole run at a single scale, each stop drawn as the device that sector lives in (build box,
office switch, media platter rack, worm-eaten camera rack, AI core), with the crossing named between
stops. It is not mounted in a menu. When a sector loader exists, this plate is the load screen it should
fade through.

```
LOCALHOST --open web--> OFFICE LAN --smart TV--> CINEVAULT
         --botnet relay--> BOTNET --C2 backbone--> SINGULARITY --root--> THE SUCCESSOR
```

## Run shape

A sector is a small graph of arenas, not one open field. Players move between arena nodes through bridges,
paired teleporter pads, or a lift. The graph carries the fiction and the pacing: a bridge is a held
corridor, a pad is a fast rotation between objectives, and a gate is a fight that must be finished before
the next edge opens.

The five-sector arc starts in a local sandbox, escapes through a firewall, router, and modem, then travels
the open web into the systems that will define the rest of the campaign. The player is always heading for
one destination, not collecting separate stages.

| # | Sector | Network fiction | Topology | Boss |
| --- | --- | --- | --- | --- |
| 01 | LOCALHOST | dev sandbox, firewall, router, modem | forked start, one gate, one loopback pad | THE WARDEN |
| 02 | OFFICE LAN | neighbor office switch and server racks | central pad hub with four desk arenas | THE ADMIN |
| 03 | CINEVAULT | film collector's home media network | central lift through four round disk arenas | THE CURATOR |
| 04 | BOTNET | compromised devices held by worms | worm-eaten mesh with two nests and tunnels | THE BROODMOTHER |
| 05 | SINGULARITY | rival AI data center | cold-aisle gauntlet to the core | THE SUCCESSOR |

## Topology grammar

| Element | Meaning | Traversal |
| --- | --- | --- |
| **Arena node** | One playable arena, one `ArenaDef` blockout | Entry and exit points connect to its links |
| **Bridge** | Corridor or open connector | Walk through. Can be gated by a cleared encounter |
| **Teleporter pad** | Paired point-to-point transfer | Stand on the pad, short transition, arrive on its pair |
| **Lift** | Shared hub for several destinations | Choose a floor, move the whole local party |
| **Gate** | A link that unlocks after a condition | Boss kill, switch break, or all side nodes cleared |
| **Boss node** | One large encounter with phases | Sector exit stays closed until the boss is dead |

No geometry is carried in snapshots. A future sector runtime would send the sector id and node id and use
the same host-authoritative model as a match.

## 01 // LOCALHOST

`BUILD ROOT` forks to `UNIT TEST` or `DEP CACHE`. Both routes converge on `FIREWALL GATE`, then `ROUTER`,
then `MODEM`. The router has a loopback pad back to the cache once the route is open.

This is the tutorial sector. It teaches bridges, one optional branch, one pad, a boss gate, and the feeling
of leaving a closed system. The firewall chamber should read as a machine room with a beam source and a
breakable switch, not a plain corridor with a boss in it.

Next sector: `MODEM` opens onto the web, and the web route lands in `OFFICE LAN`.

## 02 // OFFICE LAN

`VPN GATEWAY` leads into a `NET SWITCH` hub. Four teleport pads connect the switch to `RECEPTION`,
`ACCOUNTS`, `DESIGN BAY`, and `MEETING ROOM`. Two server racks branch off the switch by service bridge.
`DOMAIN CONTROLLER` guards the `FIBER UPLINK`.

Each desk is a small arena with a different office silhouette: desks and chairs, a reception counter, a
conference table, a design wall. The server racks use larger arenas and slower, heavier threats. The
switch room should be a safe-ish crossroads where players choose the next desk and can see the pad lights
change as desks go dark.

Next sector: the fiber uplink carries a stray smart-TV route into `CINEVAULT`.

## 03 // CINEVAULT

`HOME ROUTER` opens to `PROJECTOR` and `CONSOLE`, with a central `MEDIA SERVER` that holds `THE CURATOR`.
After the boss, the `CENTRAL LIFT` connects four round disk arenas: `DISK 0` films, `DISK 1` series,
`DISK 2` music, `DISK 3` backup. All four must be purged before `STREAM UPLINK` opens.

The lift is the identity of the sector. It should feel like a physical elevator moving between platters,
with a short mechanical beat between floors. Each disk arena can use a different media hazard: projector
cones, surround-sound pressure rings, film-strip rails, or a corrupted screen that changes the floor.

Next sector: the stream uplink answers a botnet relay.

## 04 // BOTNET

`CAM 07` forks to `DVR VAULT` and `PRINTER FARM`, then into `C2 RELAY`. Two nests, `NEST A` and `NEST B`,
flank the route. A worm tunnel connects the nests. `THE BROODMOTHER` holds the center, and `C2 BACKBONE`
is the exit.

This sector should not look like an office. The devices float on a broken mesh, connected by worm-eaten
tunnels and unstable bridges. Worms are the terrain. Nests should be destructible objectives that keep
spawning pressure until they are burned out. Enemy factions can fight each other here more openly than in
the earlier sectors.

Next sector: the command backbone reaches `SINGULARITY`.

## 05 // SINGULARITY

`EDGE BALANCER` opens to two rack arenas, `RACK A1` and `RACK A2`. `COOLANT SPINE` is the central hazard,
splitting into `GPU FARM` and `COLD AISLE`. `SECURITY CORE` is the last mini-boss before `THE SUCCESSOR`
at the AI core. A coolant loop pad connects the lower rack to the GPU farm.

This is the finale. Use every language the campaign has taught: firewall sweeps, destructible data walls,
transmitters that reflect shots, and a boss that changes the arena rather than only adding health. The
final arena should be readable in one screen even if the approach is multi-screen.

## What each map sketch needs

A rough top-down drawing is enough. I can turn it into an `ArenaDef` blockout.

For every arena:

1. **Name and sector.** Use the labels in the archive or rename them if the fiction improves.
2. **Sketch with a border.** Mark the playable area. If the arena is larger than one camera screen, draw
   the 1280×720 camera window on it and note how the camera should follow.
3. **Cover.** Walls, desks, racks, platters, server cabinets, broken terrain. These are collision geometry,
   so draw them as solid shapes, not floor texture.
4. **Entry and exit points.** Mark where players arrive and leave, and which link type connects them
   (bridge, pad, lift). Pads need a pair, so name both ends.
5. **Spawn ring.** Show where 1–4 players assemble. If enemies spawn from fixed doors or vents, mark those
   separately.
6. **Hazard or objective.** A switch, a firewall emitter, a disk platter, a nest, a vent, a transmitter.
   Mark its footprint and what changes when it is destroyed.
7. **Boss footprint.** For boss arenas, mark the boss body, its movement lane, and the space players need
   to dodge. Note phase changes if they alter the floor.
8. **Colour and material notes.** A sentence is enough: cold server aisle, warm office carpet, glass
   platter, wet coolant trench.

For every link:

- The two node names.
- Bridge, pad, or lift.
- Width in player diameters, and whether cover sits on the link.
- What unlocks it: boss, switch, all desks, all disks, or nothing.

For every sector:

- Mandatory route and optional rooms.
- Boss trigger and exit condition.
- Expected run time.
- What happens on a party wipe: restart the sector, restart the arena, or lose one run.

## Decisions needed before a playable slice

1. **Scene transitions.** The scaffold assumes each arena is its own scene, with a short load or camera
   cut on a bridge or pad. If you want one continuous map with no cuts, the runtime model changes.
2. **Party and wipe rules.** Shared lives, individual respawns, or a full-party wipe that resets the
   current arena. This decides how hostile bridges can be.
3. **PvP in PvPvE.** Can players damage each other everywhere, only in marked arenas, or only after the
   boss is engaged? The answer changes spawn placement and pad timing.
4. **Boss scaling.** One boss for 1–4 players, or a different pattern count per party size. The local
   thrall controller is a useful base for boss-authored `InputFrame`s.5. **Run persistence.** The scaffold assumes one run across all five sectors, saved after every completed
   level into one of three local slots. Still open: whether a death rewinds to the last level or the last
   sector checkpoint, and whether a resumed run keeps the slot's program and companions (the slot format
   already stores both).
6. **Pad feel.** Instant cut, a 0.4 s materialise, or a short transit lane. This is a feel decision and
   should be tested before every sector uses pads.

## First implementation slice after the maps

1. A local-only `SectorRuntime` that loads one arena node at a time and keeps party state between nodes.
2. Bridge and pad transitions, with the same fade/assembly language as the level intro.
3. One complete sector, `LOCALHOST`, with one boss and the modem exit.
4. Gate and switch state in the local runtime only. No snapshot fields until networked PvE gets a
   protocol decision.
