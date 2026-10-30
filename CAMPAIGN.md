# CAMPAIGN // route blueprint

Status: design scaffold, not a playable mode. The route blueprint reads authored data from
`src/game/sectors.ts` but is currently parked with no menu entry while the story flow is built.
`SINGLE PLAYER > CAMPAIGN` is the story-mode entry: three local save slots first, then for a new run a bot
count and player select. The run is meant to save after every completed level via `src/game/saves.ts`.
Neither surface enters `World`, `Snapshot`, rooms, or the network. Any networked PvPvE run still needs its
own protocol work.

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
level and player count. Nothing is playable yet, and the blueprint archive is parked until the flow is
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
