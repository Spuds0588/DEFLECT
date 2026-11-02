# DEFLECT — Game Guide

How to play, what every mode contains, and what to test. For the tech stack, architecture and network
design, see [README.md](README.md).

**Play the current alpha:** <https://spuds0588.github.io/DEFLECT/>

**Kiosk demo:** [launch the unattended demo](https://spuds0588.github.io/DEFLECT/?demo=true) — the
`DEFLECT_` wordmark over a live bot-run gauntlet, fading away and returning on a 60-second loop. Runs
rotate between one, two and three local pilots; the three-player runs stay on compact arenas so the whole
fight remains one shared view. No input, no menus, no exit; leave it by closing the tab.

## What is playable now

- **Training:** a sparring drone, or endless 1v1–1v3 bot practice with no rounds.
- **VS BOTS:** normal round matches against one to three local bot opponents, first to 3.
- **GAUNTLET:** a scored, one-life local run against worms, viruses, cascading errors, sentries and
  infected thralls, with a local top-eight table.
- **CAMPAIGN:** `BUILD ROOT`, the first playable story level, with three local save slots. More levels are coming soon.
- **Online:** host or join a room for up to 8 players.
- **Session feedback:** after a result, choose `SHARE FEEDBACK` to share an opt-in JSON report of the session. It includes setup, player action totals, round results, deflect sources and FPS/sim samples; callsigns, room codes and raw inputs are omitted. Browsers without file sharing download the report and copy a summary.
- Thirteen programs, thirty-two arenas.
- **SPACE CADET:** a tall pinball cabinet with round posts, three kickers, a bottom drain and a right-wall feed that cycles files, live balls, viruses and sentries into the table.

Everything below is the current alpha, including the rough edges.

## The one-stick rule

There is no aim stick. **Movement is facing.** Melee attacks lock the direction you commit to. Dashing
commits to the **last movement direction**, even while target lock is holding your facing, so strafing
past an enemy and dashing goes sideways. Standing still keeps your last facing.

Keyboard is 8-way. A gamepad stick is analog: a partial tilt moves slower but still sets facing. The
mouse never sets facing, only buttons. The touch stick follows the same rule as a pad.

## Modes

### Training

`SINGLE PLAYER → TRAINING → program` walks through the arena grid (navigate in all four directions), bot
count (`NO BOTS` for the sparring drone, or `1 V 1` through `1 V 3`), and difficulty. Difficulties stack
vertically from `EASY` to `HARD`, with an `IMPOSSIBLE` tier reserved as the top of the ladder. Each choice
advances immediately: pick an arena to choose the bot count, pick a count to choose difficulty, and pick a
difficulty to start. There is no extra NEXT/RUN step. Training has **no rounds**: every dead body respawns
and the session continues until you leave. Training and VS BOTS remember their difficulty separately.

`NO BOTS` keeps the sparring drone: it drifts, fires slow bolts and respawns.

### VS BOTS

`SINGLE PLAYER → VS BOTS` uses the same setup but runs the normal match flow: countdown, last-standing
rounds, first to 3. Bots take the programs you leave unused, so a Wedge pick can face Probe, Fisher and
Sweep. They use the same movement, facing, melee, dash, skill and heavy rules as you; they cannot aim
independently of movement.

After difficulty, choose a series length: `1 GAME`, `3 GAMES` or `5 GAMES`. Each game is still first to
3 rounds; the series tracks games won, and a three-or-more-player series can end in a tie. `MAPS: RANDOM`
is the default and rotates through the arena pool without repeating the last map; `MAPS: FIXED` is the
custom choice and keeps the arena you picked. Between games, `NEXT GAME` starts the next map and keeps the
series score. The final panel reports the series winner and starts a new series or returns to setup.

- `EASY`: slow reactions, loose aim, forgiving fire cadence.
- `MEDIUM`: reads projectiles, leads movement, uses skills, power attacks and dashes.
- `HARD`: 55 ms reactions, near-perfect lead, aggressive deflects and spacing.
- `IMPOSSIBLE`: the reserved ceiling. Faster fire, no aim error, full dodge; still being tuned.

Three styles alternate across the three bots: `DUELIST` closes distance, `TRICKSTER` orbits and looks for
deflections, and `SIEGE` holds range and charges beams. Wedge bots plant their bracket between themselves
and incoming fire, and Fisher bots drop a lure before stepping away; a bot never chases its own beacon.
Bots raise the guard against incoming shots outside melee reach, including sentry bolts and missiles in
the gauntlet, and swat the ones that arrive close. Bots route around cover with a small per-arena grid
path instead of hugging the nearest wall. They are local-only test opponents; they do not occupy
multiplayer room slots.

### Gauntlet

`GAUNTLET` is a local threat sandbox, not ranked PvP and not networked. Pick an arena and begin a
one-life run. Run setup has a `FRIENDLY FIRE` toggle, on by default: enemy shots can damage other threat
families. Turn it off and hostile fire passes through worms, viruses and error blocks, so only you are at
risk. The same saved rule applies to a campaign run. When your last health segment goes, the run ends and
the results overlay records your callsign, arena, wave reached, survival time and kills. There is no
in-run respawn; training is the practice space.

`NETWORK SWITCH` is a rectangular feed floor: four destructible pipes on the long walls alternate
launching hostile file boxes and enemies into the room. The boxes damage on contact; the pipes also have
an intake that pulls loose files and small threats into the mouth. Shoot a pipe down and that feed and its
intake stop for the rest of the run. The west-end firewall plate starts one sweep from the far wall and
rearms after three minutes.

The setup screen shows the local top eight runs, ranked by wave, then survival time, then kills. The
title menu shows your best wave beside the gauntlet option. Records live in `localStorage` and never enter
a network snapshot. Waves are 30 s and the ramp is deliberately slow: worms arrive at wave 3, viruses at
6, triplex shooters at 9, cascading errors at 12, homing pods at 15 and flocks at 18. Spawn intervals
tighten across roughly 120 waves, and live caps grow one step at a time. A wave never forces a
synchronized burst of every threat; existing countdowns keep running. Each arena changes the zones the
threats hold.

- **WORMS:** trailing chains of red squares. They patrol a territory anchor, eat bolts and viruses, and
  damage on touch. They only commit to you if you enter their patch or hit them, then lose interest after
  5.5 s and return. A player who closes inside 76 units draws a telegraphed **bite**: the head rears, then
  lunges 34 units into a 56-unit reach for 1 damage and a hard shove. Back off, dash through it, or break
  line of sight to waste it. Longer chains move slower. Cover blocks them. A virus that catches one turns
  it into a faster hunter.
- **VIRUSES:** magenta diamonds that spread toward roam points instead of beelining across the map. They
  pursue a player only inside 310 units, or an uninfected worm inside 560 units. Touching you fills the
  infection meter; at full meter a **THRALL** copy of you spawns nearby and fights with your own
  single-stick rules. A virus that lines you up at 34–150 units winds up and **charges** in a straight
  line for 1 damage and a 540 shove; sidestep or dash to make it miss, then punish the recovery. They
  still infect worms and split on a timer.
- **SENTRIES:** pulse squares, triplex shotguns, homing trapezoids and dart flocks. They land in a zone
  and hold it, with a 100–250 unit leash instead of following you across the arena. Heavy triplex and
  homing silhouettes are much slower than the pulse and flock. A pulse square or a flock that finds you
  inside 92 units stops shooting and **rams** instead: a short wind-up, a 0.16 s dash, 1 damage and a 620
  shove, then a recovery beat. Only one sentry commits at a time, so a dart flock cannot stack three hits
  on one frame. Packs arrive one at a time, low-tier shots are short-ranged and disperse on cover, and
  enemy fire damages other enemies too while `FRIENDLY FIRE` is on.
- **CASCADING ERRORS:** yellow blocks stamped with red exclamation marks. They spread outward like a
  plant, one block every 4.0 s early and 2.0 s at full pressure, hurt on contact, and take three hits to
  delete a single block. The first colony starts at four blocks and the live cap grows over many waves.
- **FIREWALLS:** orange beams that warn, then sweep across the arena burning players, worms and viruses.
  Pillars cut both the visible beam and the damage. Automatic firewalls are **off**. `NETWORK SWITCH`
  carries one manual starter at its west end: stand on the plate to launch a sweep, then wait three
  minutes for it to rearm.
- **HEALTH:** enemy hit points are deliberately low so a crowded screen can be cleared. Worms, viruses,
  errors and shooters all die faster than in v0.1.8; firewalls burn enemy factions harder.

The gauntlet sandbox is local. INFECTION also has a co-op room mode, where the host owns the colony and
sends it to the other players; no other gauntlet enemy crosses the network. Hits push, throw a directional
spray of rotating triangles, and tilt the view by the amount set in Settings.

### Infection

`SINGLE PLAYER > INFECTION` is a timed clear, not a survival run. Pick a program and an arena: every
operator starts on the **left** in one launch line, while twenty-four viruses queue just beyond the
**right** lip. The colony enters as a tide, crosses the middle and hunts you across the whole arena. New
bodies reuse the virus pool and glide in from the right rather than appearing in place, so the pressure
reads as an endless feed even while you are clearing it. The top of the screen carries the only number
that matters: **VIRUS CLEARED**, rising from 0% to 100%, with the run clock underneath. Clear the last
body to stop the clock; the fastest clean sweep per arena is kept on the title menu as `BEST`.

Online, host a room and set the lobby's `MODE` to `INFECTION`. Up to eight operators share the same
colony, clock and clear meter. The host owns every hit and the virus movement; other players render the
swarm and fight. Each operator has one life: a downed player stays in the room as a spectator, and the
attempt only fails when nobody is left standing. The host can retry a failed or cleared run for the whole
room from the result screen; guests can leave. The host records the clear time locally.

- The meter is live, not a quota: `kills / (kills + living)`. A fresh split pushes it back. It only
  reaches 100% when nothing is left alive.
- Some arrivals are visually doubled or tripled by a fake swarm cloud. The satellites are only drawn;
  the whole group still has one hitbox, one health point and one kill. The extra bodies are there to
  make the right side of the arena read as a colony, not a row of single targets.
- Viruses **bite on contact** for one segment and shove you clear; eight tenths of a second of grace keeps
  a packed screen from deleting you on one frame. They do not wind up or charge in this mode, so the
  swarm is a wall to kite, not a line of jousters.
- There are no powerup drops, no pickups and no friendly fire, so a best time is about the swarm and your
  kit, not a lucky roll. Arena emitters and floor hazards still run.
- One life each. Solo, a broken ring ends the attempt and no time is recorded; co-op continues while at
  least one operator is standing. `RETRY` starts a fresh flood, `ARENA` goes back to the grid and `TITLE`
  leaves. Nothing is saved mid-run.

### Campaign

`SINGLE PLAYER > CAMPAIGN` opens three local save slots first. An empty slot starts a new run: pick the
bot count (none to three), then your program. A filled slot shows the level and player count and resumes
the run, skipping both steps. Bots take the programs you leave unused.

`BUILD ROOT` opens in quarantine. The Warden talks you through move, dash, ranged attack, lock and target
cycling, melee, and reflection on the bare intake plate while six shapes sit dormant in the holding
office. Finish the lesson (or skip it), cross to holding, and the shapes wake as **wave 1**: a bouncing
blue circle, a floating red mother with a shard cloud, and a yellow row of clones that charges together.
The cell block stays solid while it is sealed, so the held wave cannot leave early and you cannot walk
into the cells. The three civilian monitors in that office are destroyed in the breakout, dropping
any files they carry, and script_kitty watches from the middle cell. The Warden teaches your **skill**
while wave 1 is live. Clear all six and finish that lesson to make the cell block lose power: the bars
retract unexpectedly and release **wave 2**, two viruses and a worm, while the Warden teaches your
**power attack**. They are already in the cells behind the bars; the power-down releases them instead of
spawning replacements. Clear wave 2 and finish the heavy lesson, then spar against the bot squad (a `NO BOTS`
run still drills against one instructor), survive a `SYSTEM BREACH` warning, then the floor is already
full when the assault starts: a squad is posted on every plate beyond intake, and two red **open ports**
leak more onto the mainboard while a third feeds the router. Any attack that does damage closes a port —
ranged shots, the lash, a damaging skill or a damaging super — so bring the whole kit. A port takes
20–26 hits and leaks a threat every few seconds until it shuts, and a shut port stops feeding that plate
for good. Closing both mainboard ports extends the bridge to the router; closing all
three opens a **white party port** on the router uplink while script_kitty explains the infection was
routed in from another network and the hop continues. Walk into the white port to clear the node. Enemies
still alive do not block that exit, because closing the sources is the win.
The clear reports
kills, time, damage taken, data crates preserved and a score; losing no crates is a clean sweep and pays a
bonus, and the best score and sweep count stay in the slot.

Clearing writes the slot, marks it COMPLETE and shows `MORE LEVELS COMING SOON`. `REBOOT` on `GRID ZERO`
is authored but parked until the next route segment ships; it is not in the live level list. A run is
never saved mid-level. The layout brief and handoff checklist live in [CAMPAIGN.md](CAMPAIGN.md).

### Online status

Online rooms expose a small local status readout. The lobby shows the measured round-trip time beside the
room stats, and a game adds an `MP STATUS` panel in the top-right with your role and slot, the room code,
the connected operator count, smoothed RTT and the measured snapshot rate. The host averages its guests;
a guest measures the host. This is connection feedback only: it never changes movement, hit detection,
scoring or the host's authority. If a peer does not support the ping exchange, `RTT` stays at `--`.
`GAME UI` hides the panel, as does any screen overlay.

### Online series

When hosting a versus room, the lobby's `SERIES` control chooses `1`, `3` or `5` games and `MAPS` chooses
`RANDOM` or `FIXED`. The host owns both rules. A series keeps the room together between games: the host
starts the next map from the result panel, and guests receive the new arena and game number automatically.
`RANDOM` rotates through the online-safe arenas without repeating the previous map; `FIXED` uses the
arena selected in the lobby. Infection ignores the series and remains one shared run.

## Multiplayer menu

`MULTIPLAYER` offers `ONLINE` (host a room or join by code) and `LOCAL` (same-screen arena versus).

### Local

`LOCAL` is arena versus for two to four players on one screen. P1 is the keyboard and mouse; every
detected controller is adopted as P2, P3 or P4 and appears in the seat list. Plug in a controller on the
setup screen, or press a button on one during a match, and that player drops in immediately. The match
starts once at least one controller is seated. A disconnected controller keeps its player and body for a
moment; reconnect the same pad to take it back. Each local player gets a readiness dock and rumble on
their own pad. Local gauntlet co-op is not built yet. Public
room discovery is planned: it will search for game codes with a shared prefix, while private rooms keep
an unprefixed code.

## Controls

Gamepad, keyboard/mouse and touch are supported. The most recently used device takes over; there is no
on-screen input-mode badge. A phone or tablet gets the touch layout automatically, and `?touch=1` /
`?touch=0` forces it on or off for testing.

| Action | Gamepad | Keyboard/mouse |
| --- | --- | --- |
| Move + face | Left stick | `WASD` / arrows |
| Melee attack / guard | `B` | Left mouse / `J` |
| Ranged attack | `X` | Right mouse / `K` |
| Power attack (hold) / skill (tap) | `Y` | `E` or `L` / middle mouse |
| Lock target | `LT` (hold) | `Q` (toggle) |
| Cycle lock target (while locked) | `RB` / right stick left-right | `R` / `F` |
| Dash / charged dash | `A` or `L3` | `Shift` / `Space` |
| Confirm / menu | `A` / `Start`, D-pad | `Enter`, arrows, focused button + `Space` |
| In-game menu | `Start` | `Escape` |
| Hide/show UI | `View` / `Select` | — |
| Mute | — | `M` |
| Perf HUD | — | `F3` |

**Touch layout:** a stick at the bottom left and `SHIELD`, `SKILL` and `DASH` buttons at the bottom right.
The stick sets facing by movement, exactly like a pad: it is not a second aim stick. Tap `SHIELD` for the
lash and hold it for guard/reflect. Tap `SKILL` for the program skill and hold it for the power attack.
Tap `DASH` to dodge and hold for the charged dash. `AUTO LOCK` and `AUTO ATTACK` default on for touch and
live in `SETTINGS > CONTROLS`: auto lock holds the nearest visible target, and auto attack fires the ranged
attack on that target, switching to melee inside reach. Both can be turned off; with both off the touch
layout has no manual ranged button. The touch layout hides the minimap and puts the readiness dock at the
top centre. `GAME UI` hides the canvas readout but leaves the stick and buttons, since those are the
phone's controls.

The title is a console menu: arrows or the left stick move the `>` cursor, Enter or `A` confirms, and
Escape or `B` backs out. `HOW TO PLAY` holds the control tables and a short rules and program rundown; it
shows a gamepad, touch or keyboard/mouse layout based on the input device. `SETTINGS` is the fourth
option. `SETTINGS > FEEDBACK` holds hit rotation, impact flash, scanlines, minimap, game UI, rumble and the
hit-preview test; `SETTINGS > AUDIO` holds the volume controls; `SETTINGS > SYSTEM` holds the callsign and
reset; `SETTINGS > CONTROLS` holds auto lock and auto attack.

Controller rumble is on by default and can be switched off in `SETTINGS > FEEDBACK`. It uses the standard
Gamepad `vibrationActuator` where the browser exposes it and falls back to the older `hapticActuators`
pulse surface; a pad without either stays silent. Cues are short: a tap for a swing or dash, a light tick
for a caught shot, a thump for a spent health segment, a boom for a nearby explosion, and a longer death
thump.

## Health, attacks, skill and power

Your avatar has its health segments built into its rotating program outline: three for most programs,
**six** for Atomize and Compress. A hit drops that segment to a dim ghost, so the silhouette always stays
whole while the damage still reads at a glance. There is no separate health bar or name plate: the
outline, the inner energy arc, and the readiness dock are the local readout. Bots and remote players show
no health or readiness telemetry yet.

| Option | Input | Role |
| --- | --- | --- |
| **RANGED ATTACK** | `X` / right mouse / `K` | Your program's basic fire. Probe sends a five-shot stream, Wedge a three-shot string, Fisher a piercing spear, Sweep throws a dust-trailing broom that shoves on contact, Toxic fires a venom needle, Kaboom lobs a slow bomb, Bad Lag throws a heavy hourglass, Atomize fires an alternating electron that curves toward a target, Ghost throws a wide chomping mouth that hits for two and dazes, Compress fires a slow pressure orb that shrinks the victim and permanently lowers their health cap, Pinball throws a long-lived ricochet ball that gains speed on every bounce or body and climbs from 1 to 5 damage across five hits, Copy Pasta throws a file that tears into two smaller files when it hits a body, and Aim Bot fires a 2000-speed rail round for 5 damage that never bounces and reloads slowly. Holding keeps the fire coming at the program's cadence. |
| **MELEE ATTACK** | `B` / left mouse / `J` | **Tap** for a fast spiked lash across the 180° arc in front of you. It shoves what it hits sideways and reflects shots it catches. Aim Bot carries a combat knife instead: a longer, wider sweep with a much harder shove. |
| **GUARD** | Hold `B` / left mouse / `J` | A 180° shield that reflects every shot in front for up to 1 s. Every caught shot burns shield time; a broken guard enters a 0.28 s cooldown. A catch refills the shot's lifetime and adds 1 damage, so repeat catches become lethal. Every program can do this; reflection is not a Probe-only rule. Lock on to flatten caught shots toward the target. Pinball's shield is wider and lasts longer. |
| **POWER ATTACK** | Hold `Y` / `E` / `L` / middle mouse | The program's heavy. Probe charges a piercing beam in 0.45 s; releasing the heavy while it fires cuts it short, Wedge plows forward with a bracket, Fisher draws a freeform web behind himself that reflects shots and holds anything that touches it until it fades, Sweep builds a giant broom and sweeps it across the room, Kaboom throws a row of bombs, Bad Lag dilates time, Atomize opens an orbit field that captures shots and small enemies and flings them outward, Ghost arms a jump-scare that fires on any action press (or expires) for a burst that damages everything in the ring and throws every body in it clear, Compress fires a pressure burst that halves the size and health cap of everything in the ring, crushing anything on its last point, Pinball launches one giant ball that bounces off arena walls only and rolls over bodies for 3 damage, and Copy Pasta seeds every enemy in a ring with a growing stack of red file icons that detonates after a beat. Aim Bot paints up to six red crosshairs in front of himself and fires a 12-damage shot at each in a quick sequence. Most heavies commit you: you cannot move freely while they run. Atomize's field lets you walk. Every heavy has a long cooldown. |
| **SKILL** | Tap `Y` / `E` / `L` / middle mouse | The program's assigned skill. Probe plants a persistent trap mine that waits until stepped on and detonates in a wide blast (three live max), Wedge plants a solid bracket wall behind himself, Fisher drops a lure beacon, Sweep splits two brooms outward to clear a lane, Kaboom lobs a heavy shell, Bad Lag fast-forwards, Atomize raises two orbiting shield balls, Ghost cloaks for a few seconds, Compress folds small and runs fast for 3.5 seconds, Pinball plants a flipper arm for 16 seconds that punts hostile shots and swats bodies toward other enemies, Copy Pasta summons a bot-driven copy of itself that fights for nine seconds, and Aim Bot raises a visible laser sight for 7 seconds and loads a three-shot clip that ignores his normal reload. Every Copy Pasta dash also leaves a one-hit, 1.5-second afterimage that pulls enemy attention. Its mark in the readiness dock shows when the skill is ready. |
| **DASH** | `A` / `Shift` / `Space` | Two charges, one shared recharge. Tap to pass through enemies and clear floor gaps in your last movement direction; solid cover and deployed walls stop the dash. Hold for a charged triangle dash that damages everything crossed and leaves a fading square trail. Pinball carries three charges. |

Ranged fire is the pressure tool. Melee is the answer to incoming fire: tap to lash, hold to guard. The
power/skill button is the commitment button: tap for your program's skill, hold to charge and run the
heavy. Most heavies plant your feet; Atomize's orbit field does not. Every option obeys the same facing
rules. Energy still gates the heavies; basic fire is cheap enough to hold.

## Pickups

Most pickups are dropped by enemies you destroy. Small kills roll rarely, heavy silhouettes roll
generously, and drops share a 5.5 s cooldown. At most two pickups sit on the field at once. A rare
ambient pickup (first at 24 s, then every 42 s) keeps a dry run from stalling. Training and gauntlet only.
`RESTORE_STATUS` refills health and clears negative status. Timed drops replace each other and last
11–15 s. Their state is read from the effect itself; the readiness dock is reserved for dash, skill and
power:

- `MACHINE GUN`: held ranged fire becomes a low-damage spray.
- `SCATTER`: short-range fan of pellets.
- `OVERCHARGE`: held ranged fire winds up with a fast version of the heavy charge ring, then becomes a
  beam that stays on while you hold it. Let go and the shaft cools with a spray of embers instead of
  blinking out. Dodge distance triples, and the core becomes a lightning bolt.
- `BARBED WHIP`: the melee lash and guard become a red lash with four times the reach and damage.
- `PATHFIND`: ranged bolts seek by axis-aligned right turns.

Pickups are local-only; they do not appear in competitive rooms or network snapshots.

## Arenas

Pick a card on the title screen; the host can also cycle the arena in the lobby before starting.

| Arena | Shape / intent |
| --- | --- |
| `CROSSROADS` | Four gate blocks around an open center. Symmetrical lanes and clean center duels. |
| `GRID ZERO` | Corner pillars plus central cover. The classic, readable arena. |
| `THE RING` | A hollow central box with a gate on each side. Close control fights and blind flanks. |
| `SWITCHBACK` | Staggered bars form serpentine lanes. Long sightlines and heavy ricochets. |
| `MAINFRAME` | A large multi-district map (four linked combat zones) with a camera that follows you. Cross lanes, pillar cover, a gate ring and a ricochet alley; fights move between districts. |
| `TRANSIT` | Two decks over a service trench. Cross on the central bridge, ride the paired transporter pads, or take the lift on the east end. The trench blocks bodies but not shots; a dash can clear it, while solid cover still stops the body. |
| `THE LEDGE` | No outer wall. The floor ends in a dashed lip over the void: a shove that carries a body over it kills, shots fall instead of ricocheting, and a pushed threat is a clear in the gauntlet. |
| `RECYCLING BIN` | A trapezoid floor with no cover and a big hole in the bottom edge. A 130-unit compaction plate descends every 30 s, stops on the hole's rim and rides everything on the sides down to the ledges. Breakable file boxes are the only clutter, and they are light: shove them, launch them, bat them with a guard. The compactor clock and live boxes sync online. |
| `DISK PLATTER` | A round platter with no outer wall. Nine holes turn with the disc, and a read arm sweeps across the face every 11.5 s, shoving anything it catches toward those holes or the rim. No cover: the floor and the arm are the whole fight. |
| `KEYPAD` | The entire arena is a ten-key phone pad. There is no outside floor: spawns stand on the bezel. Each 680×528 key warns for 4 s, sinks for 1.2 s, holds as solid cover for 8 s, then rises for 1.6 s. A slam crushes threats instantly; a player caught under one loses three segments. Online: the key clock is synced and the host resolves the crush. |
| `DOCUMENT SCANNER` | A large glass platen where documents load from a floor slot, a read line scans top to bottom, snaps back, and the sheet is replaced. Hop the line or dash over it. Online: the scan clock/page is synced and the host resolves the line. |
| `BROWSER` | A browser window showing a forum. A giant cursor travels to the page link, hovers, and click-slams the floor before the forum navigates deeper and the cover layout changes. Online: the page/clock is synced and the host resolves the click. |
| `QUARANTINE` | The campaign tutorial route: four separate floor plates over open void — intake (booking counter, desk cover, chains), holding (three jail cells), mainboard and router — linked by three bridge decks. Walking off a plate is a fall, and the gaps are wider than a dash. Two decks start retracted: the holding deck extends when the cell block is cleared and the router deck when both mainboard ports close. Red ingress ports sit on the mainboard and router; the router ends at a white party port. Local-only tutorial staging. |
| `USB HUB` | A round hub with four thumb-drive islands pushing out on a shared cycle. Only the hub and drives are floor; the gap grows to 230 units, so a dash can cross while the drives are travelling but not at full extension. While a drive extends, its current pushes outward; while it retracts, the current pulls inward, carrying players and threats off or onto the islands. Online: the drive clock is synced and the host resolves the ride. |
| `SWIPE RIGHT` | A tall phone touchscreen showing a dating deck. Every 4.6 s the card swipes left or right and the whole floor slides 108 units that way, carrying every fighter and live shot toward the wall. A `YOU GOT A MATCH` popup rises from the center of the screen for a few seconds as real cover: it blocks bodies and shots, displaces anyone caught under it, then drops back into the floor. Online: the swipe and popup clocks are synced and the host owns the carry and collision. |
| `ROCKET NAVIGATION` | A launch-control floor under a nav display. The rocket lifts from below the bottom lip while speed, altitude and trajectory count up. Its growing arc is a real barrier: a 24 s launch lays a continuous curved wall across the arena that bodies, dashes and shots cannot cross. The finished line splits the room for the rest of the round. Booster and fairing separation marks drift off the arc as presentation only. Local-only: the launch clock and barrier are not in the snapshot. |
| `WEAPON SYSTEMS` | A fighter-jet status console: the aircraft is drawn in side profile over an instrument grid, with a status readout, a nose reticle and three chunky floor consoles — `FIRE` red, `EJECT` amber and `THRUST` blue — that also serve as cover. The jet is presentation; the consoles are the only static solids. Local-only. |
| `SPEAK & FIND` | A bright children's talking-picture toy. A prompt screen calls out a picture (`FIND THE BOAT`, `FIND THE MOON`) and the matching card pulses while a magnifier sweeps the board. Four chunky letter keys are static cover. The prompt, cards and magnifier are display art; they do not grant items or score. Local-only presentation. |
| `CAR NAVIGATION` | A GPS map screen with a serpentine route across the floor. The car drives from below the left lip to the upper-right map edge over 26 s; the travelled portion is a real barrier that bodies, dashes and shots cannot cross, and the finished route divides the arena into north and south halves. The car, stop pins, city blocks and speed/ETA/next-turn readout are presentation. Local-only: the route clock is not in the snapshot. |
| `PONG` | A green phosphor CRT court with two automatic paddles. A square rally ball serves from the centre, bounces off the top and bottom walls, and is returned by the paddles; a missed ball scores and serves again. The ball is a real local hazard: a body on its line takes a segment and is shoved, and the ball ricochets away. The cabinet, scanlines, scoreboard and paddle labels are presentation, and the court has no static cover. Local-only: the rally ball and score are not in the snapshot. |
| `AIRPORT` | The split-flap departure board is the entire floor: eighteen flight rows in two banks, nine arrivals and nine departures, with every text cell a flap element that cycles on its own clock — times, destinations, gates and statuses all change. A row warns, then lands with a wave of flaps and damages the whole bank band it occupies, not just the time cell. There is no terminal apron and no furniture, so the rows are your terrain: read which bank is about to land and move. Local-only: fixture arenas do not appear in online map rotation. |
| `SPACE INVADERS` | A black arcade fleet floor. Players fight inside a five-row, ten-column formation of pixel invaders, with three green bunkers as the static cover. A simulated arcade cannon patrols the bottom, tracks the nearest body and fires upward shots; the shots damage players and gauntlet threats and stop on bunkers. The fleet, starfield, score readout and cannon are presentation; the shots are the hazard. Local-only: the cannon, aim line and shots are not in the snapshot. |
| `FAX MACHINE` | A giant incoming fax sheet with corner toner drums and paper stacks as cover. A thermal print carriage shuttles left and right across the page; its vertical print bar damages players and gauntlet threats once per pass, then parks and reverses at each edge. The sheet copy, routing block and status labels are presentation. Local-only: the shuttle clock, page and phase are not in the snapshot. |
| `SMART PLUG` | A power-board floor with four dual-socket smart-plug modules as cover. The four socket-to-socket arcs form a circuit ring: green means safe, a red blink warns, and the red pulse damages anything caught in the live arcs once per pulse. The centre and the outside are safe pockets; wait for green to cross the ring. The board traces, LEDs and voltage readout are presentation. Local-only: the green/red clock and live arcs are not in the snapshot. |
| `SMOKE DETECTOR` | A round detector face with a drop around its rim. Four floor smoke sensors arm the central siren when a body steps on one; it emits expanding sound rings that damage anything caught in the band. The siren runs in timed bursts, then re-arms. A mounted battery beside the siren has six health and can be shot out; destroying it breaks the alarm and disables the sensors for the round. The detector ridges, vents, LEDs and siren horn are presentation. Local-only: the alarm clock, waves and battery are not in the snapshot. |
| `SMART WATCH` | A large watch face with a digital crown, minute ticks and four raised app complications as cover. A live second hand sweeps clockwise from twelve. A body the hand crosses takes a segment and is shoved, at most once per revolution; dashing and phased bodies avoid it. The hand is a floor projection, so cover does not stop it. Local-only: the hand clock is not in the snapshot. |
| `BUSINESS LAPTOP` | A mail window with an endless inbox on the left and a message preview on the right. Four inbox cards scroll upward continuously; they block bodies and shots and keep moving when they wrap. The open message rewrites the right-side cover every eight seconds, with a new-message flash. Local-only: the inbox clock, card positions and preview layout are not in the snapshot. |
| `SPREADSHEET` | A sheet window with a 6×4 grid of cell blocks and 70-unit corridors between them. The cells are solid cover and every one can be broken: a direct ranged shot spends one of its two hits, a cracked cell shows its damage, and a cleared cell opens its lane for the rest of the round. Bombs and the heavy beam stop on a cell without breaking it. A selection cursor walks the columns and the inspector names the selected cell. Corridors do not line up, so the sheet never becomes one straight run. Local-only: cell health, the cursor and the grid are not in the snapshot. |
| `CHAT` | A chat window with four message bubbles rising continuously. Each bubble is solid cover, and the bubbles alternate the left and right half of the pane, so the open lane zig-zags as the thread scrolls. A bubble is only solid while it is fully inside the pane, so a wrapping bubble cannot block the spawn row. The pinned strip names the active line. Local-only: the bubble clock and positions are not in the snapshot. |
| `CAPCOM` | A 1968 mission-control floor split into four plates in a ring, each department laid out for its job. `CAPCOM` (flight control) sits in two offset tiers of wide flight desks facing a trajectory board. `FIDO` (flight dynamics) has three plotting tables, paper recorders and crossing plots. `GUIDO` (guidance) wraps a central gyro pedestal with corner navigation racks and a star-fix board. `EECOM` (electrical/environmental) lines its walls with switchgear and breaker cabinets around a service lane. Gaps are wider than a dash, so the ring is the only route. Local-only: room arenas do not appear in online map rotation. |
| `AIR TRAFFIC` | An air traffic control scope: one circular radar floor with a slow sweep, range rings and a bearing graticule. Aircraft cross the scope on fixed schedules, and they are hazards, not scenery — a pass damages players and, in gauntlet, every threat family it crosses. Each aircraft hits a body once per pass, so dashing, phasing and i-frames are the answer. Six console desks sit on the scope as cover, and stepping off the disc is a drop. Local-only: fixture arenas do not appear in online map rotation. |
| `SATELLITE` | A long orbital hull joined to two solar wings by narrow bridges, with a telescoping mast below and three capacitor pods above. Only those plates are floor; the gaps are open space. The wings warn, then burn anyone standing on them on independent 16 s cycles. Micro-meteors fall every 12.5 s. Destroy all three capacitors and the thrusters fire: a heat front climbs the whole map from the bottom for 14 s, then the satellite cools and the pods return. A hull-side **replicator** prints pulse units onto the deck every 4 s until it is destroyed: a satellite has no standing network port, so the infection left a machine behind instead. Online: the satellite clock, live meteors, capacitor states and reentry front are synced; the host still resolves every hit. |

### Ordinary programs

The machine world is not only fighters. Ordinary programs are civilians: floating CRT monitors with an
emoji face on the screen and a ground ring. They have no body, stand, limbs or wheels. They hover and bob,
but they have no health, collision or attacks; shots pass through them. They are scenery, not targets.
Some carry paper files behind the monitor; the stack drops when they run scared or are destroyed. A nearby live threat changes the face to fear and sends them
toward a network port, a pad or lift, or a room farther from the fight. Three work the holding office on
`QUARANTINE`: `TICKET` (teal, neutral, one file), `PATCH` (amber, friendly, empty-handed) and `CACHE`
(violet, sleepy, two files). `PING`, the rose courier, is defined for later rooms. script_kitty keeps her
cat face and sits in the middle holding cell.

### Bridges, pads and lifts

`QUARANTINE` is the tutorial route built from four separate plates rather than a single open floor. The
`INTAKE` plate is the Warden's lesson room, with a booking counter, desk blocks and chains; the `HOLDING`
plate holds the six dormant calibration subjects and three jail cells; the `MAINBOARD` plate follows; the
`ROUTER` plate is the approach to the network port.
There is no floor between the plates: walking off an edge is a fall, and each bridge deck is the only
walking route. Every gap is wider than a dash, so a shut deck cannot be skipped. Two decks start retracted
and extend on a milestone — the holding deck when the cell block is cleared, the router deck when both
mainboard ports close. The level clears when every red port is shut and you walk into the white party
port, and enemies still alive do not block that exit. Room arenas are local-only and do not appear in
online map rotation.

Traversal is arena geometry, not a separate mode. A floor gap is solid to bodies, bots and gauntlet
threats, while shots fly over it. The bridge is the only walking route across. Pads and lifts arm on a
**standing** body, not on touch, so running through one does nothing; the ring around the avatar fills
while the plate waits. A pad ride unloads the avatar layer by layer at the source, then rebuilds it at
the mate, and the body cannot act or be hit while it is in transit. A lift ride is a longer screen
transition built from deck outlines shrinking toward the centre. Both are ordinary arena data, so a
match, a training session and the gauntlet share the same links.

Open edges are arena data, not a mode. On `THE LEDGE` the bounds are a lip rather than a wall, so Sweep's
broom, Wedge's bash or a bomb can carry an opponent out, and a dash still commits you to whatever is on
the other side of it. Bots steer away from the drop and refuse a dash that would end past it. A fall is
not instant: for 0.6 s the body hangs over the drop with reduced steering, so a quick stick back can
still save you. File boxes are light debris rather than cover, and Wedge's deployed wall is solid to
shots with its own health: chip it and it cracks, then breaks.

`DISK PLATTER` makes the drop round. The plate turns slowly, so every hole travels with it; stand still
and one can drift under your feet. The read arm pivots just outside the rim and sweeps the face, shoving
players, bots and threats along its tangent without damaging them. A body caught between the arm and a
hole is a fall. A dash clears a hole (it is airborne), but landing inside one starts the same 0.6 s hang.
Hosted matches keep the plate and its holes but park the spin and the arm, because the snapshot carries no
disc phase; local training, gauntlet and campaign runs get the full moving floor.

`KEYPAD` turns the floor into ten moving cover blocks, and the keypad **is** the arena. There is no
floor around it: the housing is the playable bounds, and the eight entries stand on its own bezel.The keys are enormous: one 680×528 cap fills most of the screen at normal zoom, with the 0 spanning the
full bottom row. The digits 1–9 form the top three rows and the 0 sits centered below. Every key has the
same cycle but a different phase, so the pad is always changing shape: a warning cap lifts and glows for
4 s, sinks over 1.2 s, stays solid for 8 s and rises over 1.6 s. That warning is deliberately long: a
player paying attention can walk off a key before it commits. A player can walk through an up socket,
but a down cap blocks bodies and shots and gives the arena temporary cover. A body caught when the slam
starts takes the hit: threats are deleted, while a player loses three health segments. Cross while the
cap is up, or dash clear before it falls; a down cap stops the dash. Online, the host sends the shared
key clock; every guest draws the same caps and the host resolves the crush. The caps are also predicted
as cover, so a guest cannot walk through a down key.

`DOCUMENT SCANNER` is a paper-handling arena. A sheet rises from the slot below the platen, the read line
sweeps from the top of the page to the bottom, then races back up, and the sheet unloads for the next
one. The line burns for one health segment and shoves the body in its travel direction; a dash counts as
airborne and clears it. The safe route is to keep crossing the line, not to try to outrun a full sweep.
Every sheet has a different internal title, revision stamp and redaction pattern; those are atmosphere
and a paper trail, not a campaign objective. Online, the host sends the scan clock and page, so guests
see the same line; the host remains the only side that applies its damage.

`BROWSER` is a whole browser window showing a forum thread. The chrome band and scrollbar are solid; the
cards on the current forum page are cover. A giant mouse cursor idles over the page, moves to the link,
hovers, then click-slams the floor for one segment and a shove before the browser navigates. The forum
moves from the index into the thread, a deeper post, then a locked archive, and each page has a different
cover layout. A dash clears the click. The cursor's click is also the navigation beat, so the fight keeps
changing shape. Online, the host sends the page and cycle clock; guests rebuild the cursor, click flash
and page cards from them, while the host applies the click damage.

### Laser emitters

`CROSSROADS`, `THE RING` and `MAINFRAME` mount red laser fixtures in local training, gauntlet and campaign
runs. Each one gathers for 2.4 s, with red dots falling inward toward the lens and a shrinking ring, then
fires a short vertical or horizontal beam. The shaft stops on pillars, deployed walls, the compactor plate
and a walled arena's bounds; cover is real. A player caught in it loses one segment and is shoved along
the beam.

Face the lens with the guard raised (`B`) to catch the shaft. The return leaves along your facing, so a
held target lock sends it straight at the locked enemy; without a lock it goes back down the lane. The
reflected beam hits harder than the direct one and can cut threats, the training drone or another player.
It is the intended way to turn an arena emitter into a boss-fight weapon.

A hosted match never arms the emitters: they remain local content and nothing about them enters a
snapshot. The compactor, keypad, scanner, browser, USB, swipe and satellite are different: their clocks are
carried, so those maps also open online. The pipe/firewall arenas still stay local because their spawned
threats are not in the snapshot. ROCKET NAVIGATION's launch wall, WEAPON SYSTEMS' cockpit console,
SPEAK & FIND's card board, CAR NAVIGATION's route clock, PONG's rally ball, AIRPORT's flip clock,
SPACE INVADERS' simulated cannon, FAX MACHINE's shuttle print bar, SMART PLUG's green/red circuit ring,
SMOKE DETECTOR's alarm rings, SMART WATCH's second hand, BUSINESS LAPTOP's moving mail, SPREADSHEET's
breakable cells and CHAT's rising bubbles are local-only display content and are not in that clock list.

## Attract demo and kiosk

Leave the title alone for 24 seconds and it starts an attract demo: a random program in a random arena,
fighting a deep gauntlet wave with the canvas UI off. Any key, click, wheel or pad press brings the title
back. If the pilot dies, the arena keeps simulating the death aftermath for four seconds before the next
random run starts; it does not hold the last frame.

For a showfloor or a capture, add `?demo=true`: the same run, but input cannot leave it and the centered
`DEFLECT_` wordmark fades in, clears the screen, and returns on a 60-second cycle; the next run alternates
from one to two to three local pilots. `GAME UI` in Settings > Feedback hides the whole canvas UI layer for
a clean capture. On a gamepad, `View` / `Select` toggles that layer for the current session without
rewriting the saved choice; `Start` remains the in-game menu button.

The camera frames the local group. With several local players it stays on one screen and pulls back until
the group no longer fits, then splits into the fewest panes: one far player adds one pane, not three. Each
pane has a colored frame, the shared minimap moves to the top centre, and the sim briefly slows on a split
or merge so nobody is shot while their screen is moving.

## QA hooks

For unattended testing, add `?autoplay=2` to the local URL. Bots drive every slot, including the local
one, and the match auto-rematches so it keeps running without input. This is a QA hook, not a menu mode.

More hooks: `?split=N` lays out up to four local panes, `?gauntlet=1&arena=5&bot=1` boots a gauntlet with a
bot driving the local player, `?attract=1` boots the title demo immediately, `?demo=true` runs that demo as
a permanent, non-interactive display loop, `?ui=0` hides the canvas UI for one load, `?touch=1` forces the
phone layout and `?debug=1` exposes a read-only inspection handle. None of them appear in a menu or a
snapshot.

## Things to test

This build is a test rig as much as a game. A useful pass:

- Every arena in training. Learn `THE RING`'s four side gates, `SWITCHBACK`'s ricochet lanes,
  `MAINFRAME`'s linked districts, `THE LEDGE`'s open lip and `DISK PLATTER`'s moving holes.
- On `SWIPE RIGHT`, wait for the first card swipe and watch every body and live shot carry toward
  the same wall. Stand under the center as `MATCH INCOMING` warns, then confirm the popup lifts you
  out and blocks shots until it drops back into the floor. Host a room and check that a guest sees
  the same card, swipe and popup clock.
- On `SATELLITE`, stand on a wing through the warning pulse and confirm the hot panel takes a segment.
  Ride the bottom mast up and down, then dash into its barrel to confirm it still stops you. Destroy all
  three top capacitors and watch the heat front climb from the bottom; do not stop until it has passed
  the top and the pods return. Host a room and confirm a guest sees the same solar warning, meteor
  impacts, capacitor pods and heat front.
- Finish a training session or a gauntlet run, then select `SHARE FEEDBACK` and confirm the report opens
  your share sheet or downloads a JSON file with a copied summary. Check that the report contains the
  arena, mode, program and round/action counts but no callsign or room code.
- On `THE LEDGE`, shove a bot over the edge with Sweep's thrown broom. It should de-rez at the lip and the
  round should end; walk over the same edge yourself and you should fall too.
- On `DISK PLATTER`, stand still and watch a hole drift under you; the 0.6 s hang should give you one beat
  to walk out. Then stand in the read arm's path and let it shove you toward a hole. A dash should clear a
  gap but landing inside one should still drop you.
- Start training with `NO BOTS`. The sparring drone should drift, fire slow bolts and respawn.
- 1v1, 1v2 and 1v3 at each tier. `EASY` is a moving target; `HARD` punishes slow attacks and bad dashes.
  Training never ends on a round; bots respawn after each defeat.
- Watch a Wedge bot under fire turn away and plant a wall between itself and the bolt. Watch a Fisher bot
  drop its lure, then step out of the way instead of standing on it.
- Break line of sight behind cover. Bots should walk a route around the block, not scrape against it.
- Fight inside `THE RING`'s center. Every entrance is a gate; a charged beam down a gate is a trap.
- Bank bolts around `SWITCHBACK`'s bars. Deflected bolts gain speed and damage, and a catch refills their
  lifetime: a returned shot can cross the whole arena, so keep tracking it after the catch.
- Hold ranged attack and feel the program's stream and short recharge. Losing health segments should be
  readable from across the arena.
- Hold `B` and walk into a sentry volley. The 180° shield should catch every shot in front, burn down as
  it eats them, and force a quick cooldown when it breaks. Release early and it drops immediately.
- Lock on with `LT` (or toggle `Q` on keyboard) and hold the shield. Reflected shots should flatten toward the target instead of
  flying off at the incoming angle. The reticle should acquire pulse squares, triplexes, homing pods,
  flocks and cascading-error blocks as readily as worms.
- Spend your dodge charges (three as Pinball), then watch the chevrons in the readiness dock refill one at
  a time.
- Hold `Y` through the full charge. The two orbit dots should meet at your front and the beam should fire
  on its own, root you, sweep slowly, and pierce every target in the line while pillars cut it off.
- Release `Y` after the beam starts: the beam should stop immediately, the root should end and the
  cooldown ring should begin. Plant a trap, walk away and leave it alone; it should wait until a body
  enters the trigger, and the faint outer ring should mark the larger blast.
- Tap `Y` for the program's skill: Probe's persistent trap mine, Wedge's bracket wall, Fisher's lure beacon,
  Sweep's split brooms, Kaboom's lobbed shell, Bad Lag's fast-forward, Atomize's two blue shield balls,
  Ghost's cloak, or Pinball's flipper arm. The mark in the readiness dock should match the program and
  show readiness. Wedge's wall should stop bodies and reflect shots; a lure should pull local bots off
  you; the split brooms should shove a body out of the lane in front of Sweep; an Atomize ball should eat
  one hit instead of a health segment; a cloaked Ghost should be ignored by bots and passed through by
  shots.
- As Ghost, hold `Y` to arm the jump-scare: the body should re-cloak and show a pulsing ring. Press any
  action to pop the ASCII face, damage nearby bodies and throw every player, sentry, worm and virus inside
  the ring out past its edge (error blocks stay rooted), and drop the cloak. Let the window expire and
  nothing should fire. Throw a mouth into cover: it should stop and die on the geometry; a clean hit
  should leave the target dazed and visibly slower for about 0.7 s.
- As Compress, land two orbs on a bot: its six-Z hull should step down in size and one health segment
  should disappear with the cap, not just the current pool. Tap `Y` to fold small and run; the body should
  visibly shrink and cover ground almost twice as fast for 3.5 s. Hold `Y` at close range to pop the
  pressure burst: every body in the ring should halve in size and cap, and a one-health target should
  de-rez. Check a sentry: its drawn body and its hitbox should both get smaller. On a worm, the chain
  shrinks on screen; its bite reach does not.
- As Pinball, bounce a ball off two walls and into a bot: the speed should rise and the damage should climb
  1 → 2 → 3 across bodies. Throw a hostile shot into the flipper arm and it should come back at the
  nearest enemy; a body caught by the paddle should take 1 and be shoved toward another enemy. Hold `Y`
  for the giant ball: it should roll through pillars and bodies, hit each body once, and turn only at the
  arena walls. Hold `B` at range: the shield should be visibly wider and last almost two seconds.
- As Aim Bot, hold lock at the far end of the arena: the camera should pull back far enough to keep both
  bodies in frame. Fire once into open floor: the rail round should cross the room with a long speed tail
  and die on the wall without bouncing. Tap `Y` for the sight, fire three shots without the normal reload,
  then wait out the 7-second window and confirm the clip is gone. Hold `Y` in a crowd: six red crosshairs
  should appear, then six hits should land in a quick row for 12 each; a target that steps behind cover
  before its turn should not be hit.
- Reflect a `HARD` bolt back at it. Higher tiers try to dodge their own armed ricochets.
- Leave endless training and return. The arena choice persists and a fresh session starts cleanly; there
  is no round or match overlay to clear.
- Enter the gauntlet on each arena. Confirm the setup screen shows the arena, one-life note and local top
  runs. On the large arenas the first 20 seconds should contain two slow pulse shooters that land inside
  the camera window, not one distant shooter or a wave of threats. On `SWITCHBACK`, watch a worm route
  around the bars instead of passing through them. Automatic firewalls should never appear.
- Finish a gauntlet run. Losing the last segment should freeze the arena and open the result card with
  wave, time and kills; the run should appear in the setup table and update the title menu's `BEST W`
  value. There should be no respawn or practice choice in the gauntlet setup.
- Let a sentry miss you and hit a worm, virus or error block. Enemy fire should damage other factions
  instead of passing through them.
- Watch a sentry pack arrive. The silhouettes should land one at a time over several seconds, not all at
  once, and the opening minute should stay survivable.
- Let a worm eat a few viruses. Its chain should grow and its health should recover; cut it down with the
  beam before it reaches the cap.
- Let viruses stack on you until the infection bar fills. A thrall should spawn nearby, chase you, swing
  and shoot, and drop when eliminated.
- Pick up each timed drop: machine gun, scatter, overcharge (fast charge ring, a held beam that leaves a
  cooling afterglow and ember spray on release, triple dodge, lightning core), barbed whip (long red
  lash), and pathfinding (right-angle seekers). `RESTORE_STATUS` should refill your health segments.
- Stand in a firewall warning lane, then step behind a pillar. The beam should stop burning you behind
  cover. Take a bolt and a beam tick and check the push and triangle spray direction.
- Open Settings and step through Feedback, Audio and System. Change hit rotation, impact flash, volume,
  scanlines, the minimap toggle, the game-UI toggle and rumble; test the hit preview with a connected
  controller; then reset defaults. Cover should read as a bright solid object, not floor texture.
- Host a room on a non-default arena, then join from a second tab. The guest must render the host's map.
- Run a scored gauntlet long enough to trigger the new sentry pacing and pickups. The smaller minimap
  should sit tight in the bottom-left corner and track the local player plus every live threat family:
  worms, viruses, sentries, error blocks and firewalls. The training drone should appear there too.
- Tap `B` three times. The lash should sweep left, right, left with no shield fill and no forward wave.
  Hold `B` instead and the 180° shield should appear. Take a max-range own bolt, let it bounce, and confirm
  it cannot damage you.

### Gauntlet ingress

New threats arrive through red square portals that open on the arena edge, spit out a whole group in about a
second, and slam shut. The mouth is always an edge lane and always well away from your body, so you get a
readable side to watch instead of a squad appearing on top of you. Sentries, worms and virus clusters all
use the same ingress. If every edge point is blocked or too close, the burst waits rather than spawning
next to you.

### Mega Worm

The first boss. It comes through an edge portal like everything else, but it is not one body: it is a
chain of heavy plates with a head at the front. Every plate has its own health, so where you hit matters.

- **Break the middle** and the tail half tears free as a second worm. The plate at the far tip opens its
  eyes and becomes that half's head. Two bosses is a real option, and usually a mistake.
- **Break the head** and the plate right behind it opens its eyes and takes over. You cannot decapitate
  it; you can only shorten the head end the same way you shorten the tail.
- **Whip.** When it curls its head back, clear the arc. The body then sweeps a wide half-circle and throws
  anything it crosses, hard. One hit per swing.
- **One plate left** and it grows legs: it sprints, lunges with a fast bite, and spits acid in pairs.
- Damage reads as cracks spreading across a plate and loose code drifting off the body. A nearly dead
  plate shudders. There is no health bar.
- It moves slowly for its size. The pressure is the sweep and the plates, not a chase.

## IDLE HANDS (mini-boss)

Three hands hover around the floor with a red eye set in each palm. One boss, three bodies: the trio is
defeated when all three palms are gone, and each one you delete counts as a kill.

- **Slam.** A hand rears up, shrinks and flips palm-out, then drops onto a red ring on the ground. The ring
  is fixed the moment the tell starts, so walking out of it is the counter. Anything inside takes a
  segment and a hard shove, with dust on the landing.
- **Finger charge.** A hand turns to point at you, shakes, then fires forward along that line. Cover will
  not save you, but the shove is huge, so getting caught near a wall hurts.
- **The redirect.** Dash into a hand while it is mid-charge and you do not scratch it: you turn it around.
  A redirected hand slams into one of its partners for heavy damage. The trio is easiest to break by
  feeding one hand into another.
- Hands float over cover, so do not expect a pillar to block their path. They do have to respect the
  arena walls.
- **Controls note:** the boss is designed for the single stick and the dash; there is no special input.

## MEMORY FRAGMENTS

Any player who goes down in a PvE mode leaves a memory fragment at the spot where they fell, whether an
enemy, the environment or another player put them there. Walk over it to collect it.

- Each fragment gives **+1 health segment, +20% movement speed and +25% damage**, and the bonus lasts for
  the rest of the run. It stacks up to **three** times.
- Health is real: the extra segment shows up in your program's hull outline and stays through respawns.
- A body only leaves one fragment per run, so a respawning training bot cannot be farmed.
- Fragments are magnetic within a short radius and never fade. One sits where it fell until you
  take it, the run wipes, or the level ends.
- **Not in versus.** Straight PvP matches never drop one; this is a PvE rule that makes betrayal and
  squad wipes meaningful in campaign, gauntlet, infection co-op and training.
- In campaign, finishing a level is a save point: your stacks carry to the next node, and any shard you
  left on the floor is saved with them and restored on the next node. If the whole squad goes down, that
  run is not saved, so retrying from the last save point brings back only the shards that save had.

## STARFISH (mini-boss)

A five-armed starfish with a mouth in the middle. The arms whip and curl, and each one throws a fan of
spines every few seconds. The middle is plated while any arm is attached: shooting it early barely
scratches it.

- **Strip an arm.** Enough shots to one arm tears it off. The stump stays on the body, and the mouth
  opens. A detached arm is *not* dead: it crawls away with a ring around it.
- **Destroy the arm before the ring fills.** If the ring completes, the arm grows into a whole new
  starfish with five fresh arms. The pattern is: tear one off, then chase it down before it hatches.
  At most two starfish can be alive at once, so a run of ignored arms will stall rather than flood.
- **Mouth.** With at least one arm gone the middle opens, sucks you toward it, then chomps everything
  inside the inner ring. Dashing breaks the pull, and stepping out of the chomp ring avoids the bite.
- **No arms left.** The middle spins fast, sprays spines in every direction, and its suck and chomp get
  wider and more frequent. That is the window to finish it, and also the most dangerous part of the
  fight.
- Destroying the middle clears any arms still crawling, so a clean center kill ends the encounter.
- Spines are ordinary hostile shots: they can be guarded, lashed back or dodged.

## FILE BLOB (mini-boss)

A massive pile of file icons with no health bar: the pile *is* the health bar. Every point of damage knocks
files off, and the blob visibly shrinks as the stack comes apart.

- **Shoot the pile.** One damage removes one file. It starts wide and slow and gets smaller, so the last
  quarter of the fight is a small, fast target rather than a second phase.
- **Toss.** It lobs a clump of files into the air and the landing ring is fixed when the throw starts. The
  landing hurts and glues you in place with a cage of files.
- **Break out.** Shoot or swing three times to tear the cage off. A dash will not free you, and neither will
  waiting quietly: the cage times out after a few seconds. Ghost's cloak phases straight out of it.
- **Contact.** The body itself hurts on touch, so do not stand inside it while shooting.

## STORM CLOUD (mini-boss)

A huge grey cloud that sits at the top of the arena and does not come down. It rains rows of drops under
itself and throws lightning, and it slides sideways to stay above you.

- **Do not stand under it.** The lane directly beneath the cloud is where the rain lands. Step out to the
  side and shoot it from an angle; the cloud tracks slowly, so moving beats it.
- **Shoot the drops.** A raindrop is a real target: your ranged attack pops it out of the air. The rain is
  relentless enough that holding guard through a whole burst will burn the shield out, so pick drops off
  between shots instead of tanking them.
- **Reflect the bolt.** Lightning is telegraphed by a jagged line from the cloud to your feet. The line
  follows you for a moment, then locks, so a dash or a sideways step dodges it. Catch one with guard or a
  lash and send it back: a returned bolt tears a huge chunk out of the cloud, far more than a normal shot.
- **It cannot be reached from above.** The cloud owns the ceiling. Fighting it is a ground fight: keep
  moving out of the lane, shoot drops, and save your reflect for the bolt.
- **Big target, long fight.** Its body is the health bar; keep the pressure on between rain bursts.
