# CAMPAIGN // route blueprint

Status: 36 levels are playable. The live route runs BUILD ROOT
(INTAKE -> HOLDING -> MAINBOARD -> ROUTER) -> REBOOT -> NETWORK SWITCH -> DOCUMENT SCANNER -> FAX MACHINE ->
SMART WATCH -> BUSINESS LAPTOP -> CROSSROADS -> CAR NAVIGATION -> CAR RADIO -> TRAFFIC CAMERA ->
TRAFFIC LIGHT -> CROSSWALK SIGN -> AIRPORT -> AIR TRAFFIC -> CAPCOM -> ROCKET NAVIGATION -> SATELLITE ->
SPACE CADET -> PONG -> SPACE INVADERS -> ARCADE RACING -> FIGHTING GAME -> DUCK HUNTER -> TETRIS ->
SNACK MACHINE -> TOKEN DISPENSER -> SODA MACHINE -> CPU BOARD -> GPU BOARD -> DISPATCH YARD ->
LOAD BALANCER -> NETWORK BOARD. The 36 levels are 36 live route stops.
Bosses are spread across the route: REBOOT ends on MEGA WORM, AIRPORT on FILE BLOB, AIR TRAFFIC on STORM
CLOUD, SATELLITE on IDLE HANDS, SPACE INVADERS on STARFISH, and NETWORK BOARD on the USER finale. BUSINESS
LAPTOP is a normal assault again. A clear shows the route
plate after every clear, so the current network's reached devices and only the next device are named; later
devices stay unlisted. The plate auto-advances after `CAMPAIGN.routeRevealTime`, Enter/Space continues now,
and START/Escape leaves the run. The route is data in `CAMPAIGN_ROUTE`, one stop per playable level, with
explicit outgoing links ready for a future branch. A non-boss assault node with no authored `ingress` gets
one fallback port from `spawnCampaignPorts`, so every mission is clearable.

Every live-fire node carries a short `CampaignLevel.blurb` from script_kitty. It names the place the party
landed, adds one line about the infection in that device, and runs as ordinary narration over the first
seconds of the assault. It never gates a clear, never replaces the Warden/Holding/REBOOT lessons, and never
enters `Snapshot`. Levels 0-4 keep their authored lessons; the assault nodes use the landing blurb instead.
`SINGLE PLAYER > CAMPAIGN` is the story-mode entry: three local save slots first, then for a new run a bot
count and player select. The run saves after every completed level via `src/game/saves.ts`; after the last
live level the slot reports the campaign complete state.
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

## Ingress: portals, not random spawns (decided 2026-11-02)

Campaign and infection levels do not materialize enemies anywhere on the floor. Threats arrive through
**ports**: red glowing squares standing open in the arena, leaking small square particles that drift out
and fade. The port is the fiction and the objective in one body — someone is sending the bad guys through
it — and it is **damageable**. Hit it enough and it closes for good, and that port never emits again in
that level.

That changes what a clear means. The campaign assault is **clear the system**: close every port *and*
destroy every threat already in play. Enemies delivered before a port died stay alive, so a closed port
never ends a fight by itself. `campaignFloorClear` is the one gate; the objective strip counts ports
remaining alongside live threats instead of a wave number nobody can see. Infection follows the same rule:
close the colony's source rather than asking the player to outlast an unknown number of spawns.

Player characters get the **white** version of the same mark: one at the level entry, one at the exit. The
party arrives through the entry port and leaves through the exit, which gives each crossing a place
instead of a fade. Player ports are traversal dressing — not solid, not damageable, not part of the clear.

script_kitty runs the operation from the other side: it maps the network, calls out ports as they open,
tracks which island is next and coordinates the hopping while the player tries to stop the infection and
the big bad from taking the world. That is narration in the existing bottom box, so it stays cosmetic,
skippable and local-only (see **Narration rules**).

**Shared ingress and ports.** Automatic gauntlet arrivals already use the transient edge ingress: one opaque
red square with a heavy halo and square motes opens on the arena edge, releases its whole group in one frame,
and closes. Campaign ports are separate authored content (`ArenaDef.ingress`) with their own damage and
emission clock; a destroyed port is removed at once and throws red squares, with no shrink. MAINBOARD and
ROUTER mouths sit on walls; REBOOT keeps its six tuned corner feeds. `World.spawnVirusCluster`
and `setupInfection` still seed directly; a port pass should route those through the authored ports,
keeping the existing per-family pools, live caps, interval tapering and wave gates rather than adding a
second spawn system.

Settled in `World`: every damaging action closes a port; a shut port never reopens in that level; a room
cannot be left with a port still open; port health and cadence are authored per arena. Open question: how
the port count is drawn on the route plate between islands.

## Narrative spine (decided 2026-11-01, not built)

**Opening.** The campaign starts in the **quarantine section of a dev system**. Every player program — the
whole roster, including the ones that read as utilities — was pulled by antivirus and sent here to be
"retrained". The player is not picking a hero; they are picking which flagged program to run. That
retraining is the tutorial: it is where the run teaches movement, the four action jobs, guard/reflect and
dashing. The existing BUILD ROOT beats (calibration subjects, drill squad, breach, assault) are the
mechanics of the session; its fiction becomes the quarantine stop rather than a neutral sandbox.

The opening blockout is **QUARANTINE**, now four full-size separate arenas traversed by script_kitty's
portal: the round **INTAKE** office, the square **HOLDING** office with ten shallow north-wall cells, the
**MAINBOARD** feed room, and the **ROUTER** uplink. All four use the `48,48 -> 1942,1046` playfield. INTAKE
is bare, with three dormant lock targets (one of each primary) and no cover; they are placed only at the
lock lesson. Each room is its own device with a right-wall exit portal; the next room throws the party in
from its left wall. There is no walk between rooms. The holding floor is staffed
by floating CRT-monitor ordinary programs (TICKET, PATCH and CACHE); they are civilian dressing, not
combatants, and are destroyed when the calibration class wakes. script_kitty waits behind the middle cell
bars.

The Warden's basic lesson runs in INTAKE. Finishing it does not open the portal: the three dormant
subjects wake, the Warden gets one shocked line and leaves the story box, and a system objective orders
the player to destroy all awakened primitives. Clearing that class opens the first portal. The class
absorbs hits during the lesson and while any subject is still opening, so the lesson's own fire step cannot
wake them early and a held burst cannot delete the fight before the shock line. An arrival is held at the
left mouth while the hop wipe opens, then thrown east with a decaying impulse and entry protection. HOLDING opens
on kitty's first-hop line: "IT WORKED! I CAN'T BELIEVE IT WORKED." then "OKAY. I NEED YOU TO CLEAR THIS
INFECTION AND GET ME OUT OF HERE." HOLDING's six subjects are already awake as **wave 1** and carry the
skill lesson. The ten shallow cells line the whole north wall, so the held wave reads from the floor. The
block is a body solid while it is powered. Clearing all six and finishing the
skill beat makes the block fail: the bars retract unexpectedly and release **wave 2** for the power-attack
lesson — four worm chains in chapter 1, or two worms and eight viruses once OFFICE LAN unlocks them. The bodies are already in the cells, frozen and untargetable while the
block is powered; the power-down wakes them and gives them open-floor waypoints, so they walk out instead of
waiting behind the bars to be shot in a barrel. Clear that wave and the heavy
beat to open the portal to MAINBOARD.

MAINBOARD has two ingress feeds; ROUTER has one feed and two wall emitters. A room's right-wall pull starts
only after every feed is shut and every live threat is gone. The rooms are local-only and their state never
enters `Snapshot` (see AGENTS D41). REBOOT is the exception to the feed counts: six corner feeds fill
`GRID ZERO`, then the Mega Worm is announced only after all six and their delivered bodies are cleared. Its
fight is four fixed fly-by lanes with a wide arena camera and no small-enemy spawns between passes. The lane
change is a short beat, not a geometry stall. Each pass spits jagged red balls to both sides; they are
reflectable, and a returned ball damages the Worm. The arena has no outer shot wall, so fire can reach the
Worm before it crosses the lip; the player's body stays on the floor. The Worm is one rigid straight chain
with a capsule body hit test, and its plates overlap by design. The heavy beam stops at its body, and hits
spark at the actual contact point with a wide triangle spray. The minimap draws the full chain. Lethal
damage plays one last flyover: plates burst tail-first, the head spins, and the final head explosion is the
room clear.

Before an exit portal opens, the camera pulls back to show the room and holds while the mouth opens and the
party is drawn across it. The lead, open and pull timings live in `CAMPAIGN`; the zoom lives in `CAMERA`.

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
- **A replay option, not a hidden key.** Campaign setup carries a persisted `STORY BEATS` toggle, default
  play. Set to skip, it bypasses the beats entirely for that run, so a replay goes straight to play without
  dismissing each box. `FRIENDLY FIRE` is not beside it: campaign party fire is locked off. Persist the
  story-beats setting like the other campaign preferences; a resumed slot keeps it.
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
sandbox, an office LAN, a home media network, a botnet, then the rival AI's data center. script_kitty's
portal hops are the network paths between devices. Pads are direct links between paired machines. A lift
is the shared bus inside one storage device. The route ends at `ROOT`, inside `THE SUCCESSOR`.

The route blueprint is a review tool. In play, a player should not choose a sector from a menu. They
push through the current cluster, find the uplink, and carry the route into the next system.

Local traversal is still playable geometry. `ArenaDef.traverse` holds trenches, open decks, paired pads
and linked lifts, and `TRANSIT` is the test arena that mixes all three. It is one continuous arena, not a
node link: the route itself is now a script_kitty portal hop. Nothing about this geometry enters
`Snapshot`; the tests cover local play only.

## Where the archive lives

`SINGLE PLAYER > CAMPAIGN` opens three save slots. An empty slot starts a new run and continues to the bot
count (`NO BOTS` to 3, saved as `deflect.campaignBots`) and player select; bots take the programs the
players leave unused. A filled slot resumes the run stored there and skips both steps. Slots show the
level and player count. A filled row's `CLEAR` action deletes that save after confirmation. `START NEW
GAME` takes the first empty slot; when all three are full it asks which slot to replace, and the old save
is cleared before setup starts. The first two nodes are playable; the blueprint archive remains parked
until the flow is wired.

The illustrated route plate (`src/game/road.ts`) is the **between-level transition**: seven network tabs,
the current network's reached device cards, and only the next device named. Each card is the device the
arena actually lives in, not a generic level dot. It never lists arenas beyond the next one. It is not
mounted in a menu; a clear mounts it, auto-advances, and START/Escape leaves the campaign.

```
LOCALHOST --open web--> OFFICE LAN --smart TV--> CINEVAULT
         --botnet relay--> BOTNET --C2 backbone--> SINGULARITY --root--> THE SUCCESSOR
```

## Run shape

A sector is an ordered route of arenas, not one open field. Players move between nodes through script_kitty
portals, paired teleporter pads, or a lift. The route carries the fiction and the pacing: a hop is a clean
cut between devices, a pad is a fast rotation between objectives, and a gate is a fight that must be
finished before the next portal opens.

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
| **Portal** | script_kitty hop between devices | Clear the node, step into the white port, arrive on the next device |
| **Teleporter pad** | Paired point-to-point transfer | Stand on the pad, short transition, arrive on its pair |
| **Lift** | Shared hub for several destinations | Choose a floor, move the whole local party |
| **Gate** | A link that unlocks after a condition | Boss kill, switch break, or all side nodes cleared |
| **Port** | Enemy ingress: a red square that emits threats | Stand clear of its lane; damage it until it closes |
| **Replicator** | Enemy ingress where a port would be nonsense: a machine printing one family | Shoot the machine until it stops printing |
| **Boss node** | One large encounter with phases | Sector exit stays closed until the boss is dead |

No geometry is carried in snapshots. A future sector runtime would send the sector id and node id and use
the same host-authoritative model as a match.

## 01 // LOCALHOST

`BUILD ROOT` forks to `UNIT TEST` or `DEP CACHE`. Both routes converge on `FIREWALL GATE`, then `ROUTER`,
then `MODEM`. The router has a loopback pad back to the cache once the route is open.

This is the tutorial sector. It teaches portal hops, one optional branch, one pad, a boss gate, and the
feeling of leaving a closed system. The firewall chamber should read as a machine room with a beam source and a
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

### Themed chapters (2026-11-05)

Level 3 is the ROAD TRIP chapter (`CROSSROADS`, `CAR NAVIGATION`, `CAR RADIO`, `TRAFFIC CAMERA`, `TRAFFIC
LIGHT`, `CROSSWALK SIGN`), level 4 is the airport chapter (`AIRPORT`, `AIR TRAFFIC`), level 5 is the space
chapter (`CAPCOM`, `ROCKET NAVIGATION`, `SATELLITE`), level 6 is the arcade and food-court chapter (`SPACE
CADET`, `PONG`, `SPACE INVADERS`, `ARCADE RACING`, `FIGHTING GAME`, `DUCK HUNTER`, `TETRIS`, `SNACK
MACHINE`, `TOKEN DISPENSER`, `SODA MACHINE`) and level 7 is KISSINGFACE (`CPU BOARD`, `GPU BOARD`,
`DISPATCH YARD`, `LOAD BALANCER`, `NETWORK BOARD`). They are the same campaign runtime as the earlier
devices: local-only assault phases, a `CampaignLevel.opening` squad on the first frame, one data crate on a
clear spawn pad where the level has one, and no new snapshot fields. The road, airport, arcade, food-court
and server arenas carry their own local hazards; the space arenas use existing cover, the ROCKET NAVIGATION
reflector and the satellite void. The final node is NETWORK BOARD, where the USER finale holds the ceiling
over the fabric.

### Threat rollout (2026-11-05)

Each chapter introduces one family. `CAMPAIGN_CHAPTERS` owns the mapping and `campaignThreatAllowed` is the
spawn gate; an authored feed locked by the roster remaps to a legal family instead of becoming a dead port.

1. **BUILD ROOT + REBOOT:** sentries and worms. No viruses in MAINBOARD, ROUTER, REBOOT or HOLDING's cell
   wave; a virus feed becomes a worm feed.
2. **OFFICE LAN:** viruses unlock and stay in every later pool.
3. **ROAD TRIP:** no new family; the city-grid fixtures are the new pressure, while the pool stays sentries,
   worms and viruses.
4. **AIRPORT:** spinning bots are reserved (`pending`); the kit is not designed yet.
5. **SPACE:** no new family; inherits the pool.
6. **ARCADE // FOOD COURT:** magic users are reserved (`pending`); references are still required before
   their shapes or attacks are authored.
7. **KISSINGFACE:** no new family; the full mix is the test.

### Built foundations (2026-11-05)

The first three server-board blockouts are in `arenas.ts` as local-only arenas: `CPU BOARD` (37),
`GPU BOARD` (38) and `NETWORK BOARD` (39). CPU has four sockets, two DIMM banks and a central chipset;
GPU has four long accelerator cards around an NVSwitch; network is three leaf and three spine switches
around a fabric block. Their modules are ordinary cover, and they use the perimeter spawn ring. GPU BOARD
now has a timed thermal cycle: each accelerator card warns, then burns a padded skirt around itself for one
segment per 0.8 s, and the phases roll from card to card. CPU and NETWORK still have no hazards beyond
their cover. All three are KISSINGFACE route nodes now, and all three stay local-only.

`DISPATCH YARD` (40) and `LOAD BALANCER` (41) extend that foundation with live request traffic. Dispatch
has one inbound line, a three-way switch and three destinations; Load Balancer has four lanes and a
round-robin rotor. The trains warn their next lane, take one segment on contact and shove the body across
the rail so the rest of the chain passes. Both are KISSINGFACE route nodes; their request state stays
local-only.

## What each map sketch needs

A rough top-down drawing is enough. I can turn it into an `ArenaDef` blockout.

For every arena:

1. **Name and sector.** Use the labels in the archive or rename them if the fiction improves.
2. **Sketch with a border.** Mark the playable area. If the arena is larger than one camera screen, draw
   the 1280×720 camera window on it and note how the camera should follow.
3. **Cover.** Walls, desks, racks, platters, server cabinets, broken terrain. These are collision geometry,
   so draw them as solid shapes, not floor texture.
4. **Entry and exit points.** Mark where players arrive and leave, and which link type connects them
   (portal, pad, lift). Pads need a pair, so name both ends.
5. **Spawn ring and ports.** Show where 1–4 players assemble. Mark every enemy port (a red square) with
   its footprint, which threats it emits and roughly how much damage closes it, plus the white entry and
   exit ports for the party. Enemies must not arrive anywhere that is not a port.
6. **Hazard or objective.** A switch, a firewall emitter, a disk platter, a nest, a vent, a transmitter.
   Mark its footprint and what changes when it is destroyed.
7. **Boss footprint.** For boss arenas, mark the boss body, its movement lane, and the space players need
   to dodge. Note phase changes if they alter the floor.
8. **Colour and material notes.** A sentence is enough: cold server aisle, warm office carpet, glass
   platter, wet coolant trench.

For every link:

- The two node names.
- Portal, pad, or lift.
- Width in player diameters, and whether cover sits on the link.
- What unlocks it: boss, switch, all desks, all disks, or nothing.

For every sector:

- Mandatory route and optional rooms.
- Boss trigger and exit condition.
- Expected run time.
- What happens on a party wipe: restart the sector, restart the arena, or lose one run.

## Decisions needed before a playable slice

1. **Scene transitions.** The scaffold assumes each arena is its own scene, with a short load or camera
   cut on a portal or pad. If you want one continuous map with no cuts, the runtime model changes.
2. **Party and wipe rules.** Shared lives, individual respawns, or a full-party wipe that resets the
   current arena. This decides how hostile the hops can be.
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
2. Portal and pad transitions, with the same fade/assembly language as the level intro.
3. One complete sector, `LOCALHOST`, with one boss and the modem exit.
4. Gate and switch state in the local runtime only. No snapshot fields until networked PvE gets a
   protocol decision.
