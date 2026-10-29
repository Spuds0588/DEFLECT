# DEFLECT

DEFLECT is an ultra-responsive, top-down geometric duelist game built for the web. It merges the
accelerating volley tension of Lethal League with twitch-reflex arena combat. Everything in the arena is
drawn from simple neon shapes and every sound is synthesized in the browser — no spritesheet or audio
assets, only generated PWA icons.

**Playable now:** solo training against a sparring drone, local bot matches (1v1 or 1v3 at three
difficulties), a wave-based local **GAUNTLET** against worms, viruses, firewalls, cascading errors and
infected thralls, or host/join a room for up to 8 players. Five arenas are selectable from the title
screen, including the multi-district `MAINFRAME`. Match modes are first to 3 rounds; training and
gauntlet are continuous practice spaces.

## Play

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. Create a room and share the invite link / 4-character code; guests can
join from another tab, browser, or machine that can reach the app.

Production build and local preview:

```bash
npm run build
npm run preview
```

The build is a static PWA in `dist/`; serve it over HTTPS to install it and to use the offline shell.

## Controls

Gamepad and keyboard/mouse are both supported. The most recently used device takes over; there is no
on-screen input-mode badge.

| Action | Gamepad | Keyboard/mouse |
| --- | --- | --- |
| Move + face | Left stick | `WASD` / arrows |
| Deflect / combo | `B` | Left mouse / `J` |
| Weak burst | `X` | Right mouse / `K` |
| Strong: bug tap / beam hold | `Y` | `E` or `L` / middle mouse |
| Lock target | `LT` | `Q` |
| Dash / charged dash | `A` or `L3` | `Shift` / `Space` |
| Confirm / menu | `A` / `Start`, D-pad | `Enter`, arrows, focused button + `Space` |
| In-game menu | `Start` / `View` | `Escape` |
| Mute | — | `M` |
| Perf HUD | — | `F3` |

There is no aim stick. **Movement is facing.** Swinging locks the direction you commit to. Dashing
commits to the **last movement direction**, even while target lock is holding your facing, so strafing
past an enemy and dashing goes sideways. Standing still keeps your last facing.

The title is a console menu: arrows or the left stick move the `>` cursor, Enter or `A` confirms, and
Escape or `B` backs out. `SETTINGS` is option 03. Callsign editing is under `SETTINGS > SYSTEM`, alongside
hit feedback, audio, scanline and reset options.

## Weapons, bug, and health

Every avatar has three health segments built into its rotating outer ring. A hit removes one segment
completely, leaving a gap that everyone can see. There is no separate health bar or name plate: the ring,
the inner energy arc, and the floating ability icons are the whole readout.

| Option | Input | Role |
| --- | --- | --- |
| **BURST BOLT** | `X` / right mouse / `K` | Fast, short range (about 390 units), 1 damage. Three quick shots, then a **0.45 s** recharge. One bank before it expires. The three remaining shots are drawn as dots behind you. |
| **DEFLECT** | `B` / left mouse / `J` | Tap in rhythm for left, right, then forward shield wave; each arc reflects incoming fire. Holding and releasing fires a forward shield wave. The swing also punches at close range. |
| **BUG (tap)** | `Y` / `E` / `L` / middle mouse | A random skill each match: **mine**, **trap**, **wall shield**, or **ghost**. The icon floating behind the avatar shows which one you have and whether it is ready. Ghost makes you translucent and immune to damage and aggro until the timer ends or you attack. |
| **CHARGED BEAM (hold)** | `Y` / `E` / `L` | Two dots orbit from your back to your front; when they meet, the beam auto-fires for 3 s. You are rooted, but can sweep slowly at 0.55 rad/s. It passes through every enemy in the line, respecting cover. Long cooldown after the beam ends. |
| **DASH** | `A` / `Shift` / `Space` | Tap to phase through enemies and cover in your last movement direction. Hold for a charged triangle dash that damages everything crossed and leaves a fading square trail. |

The burst is the close-range pressure tool; three clean hits end a full-health target. The bug/beam
button is the commitment button: tap for your random tool, hold to plant your feet and carve a line.
Every option costs energy and obeys the same facing rules.

## Arenas

Pick a card on the title screen; the host can also cycle the arena in the lobby before starting.

| Arena | Shape / intent |
| --- | --- |
| `CROSSROADS` | Four gate blocks around an open center. Symmetrical lanes and clean center duels. |
| `GRID ZERO` | Corner pillars plus central cover. The classic, readable arena. |
| `THE RING` | A hollow central box with a gate on each side. Close control fights and blind flanks. |
| `SWITCHBACK` | Staggered bars form serpentine lanes. Long sightlines and heavy ricochets. |
| `MAINFRAME` | A large multi-district map (four linked combat zones) with a camera that follows you. Cross lanes, pillar cover, a gate ring and a ricochet alley; fights move between districts. |

## Bot matches

Choose `1 V 1` or `1 V 3`, then a tier, then `START BOT ...`. Bots use the same movement, facing,
swing, dash and energy rules as you; they cannot aim independently of movement.

- `ROOKIE`: slow reactions, loose aim, forgiving fire cadence.
- `VETERAN`: reads projectiles, leads movement, uses bugs, beams and dashes.
- `DIGITAL`: 55 ms reactions, near-perfect lead, aggressive deflects and spacing.

Three styles alternate across the three bots: `DUELIST` closes distance, `TRICKSTER` orbits and
looks for deflections, and `SIEGE` holds range and charges beams. Bots route around cover with a small
per-arena grid path instead of hugging the nearest wall. They are local-only test opponents; they do
not occupy multiplayer room slots.

## Gauntlet

`GAUNTLET` starts an endless local survival run. It is a threat sandbox, not ranked PvP and not
networked. Threat spawning accelerates every 30 s wave. Pick the arena on the title screen first; each
arena changes how the threats path.

- **WORMS**: trailing chains of red squares. They phase through cover, chase you, damage on touch, and
eat bolts and viruses. Every meal grows the chain and heals it. The charged beam hits body segments, not
just the head.
- **VIRUSES**: magenta diamonds that drift in a swarm, separate, and replicate on a timer. Touching you
fills the infection meter; at full meter a **THRALL** copy of you spawns nearby and fights with your own
single-stick rules. Viruses also infect worms, turning them magenta and faster.
- **FIREWALLS**: orange beams that warn, then sweep across the arena burning players, worms and viruses.
Pillars cut both the visible beam and the damage.
- **CASCADING ERRORS**: yellow blocks stamped with red exclamation marks. They spread outward like a
plant, hurt on contact, and take several hits to delete a single block.

Everything is local. The mode does not occupy a room slot and no enemy data crosses the network. Hits
push, throw a directional spray of rotating triangles, and tilt the view by the amount set in Settings.

## Things to test

This build is a test rig as much as a game. A useful pass:

- All five arenas in training. Learn `THE RING`'s four side gates, `SWITCHBACK`'s ricochet lanes and
  `MAINFRAME`'s linked districts.
- 1v1 and 1v3 at each tier. `ROOKIE` is a moving target; `DIGITAL` punishes slow swings and bad dashes.
- Break line of sight behind cover. Bots should walk a route around the block, not scrape against it.
- Fight inside `THE RING`'s center. Every entrance is a gate; a charged beam down a gate is a trap.
- Bank bolts around `SWITCHBACK`'s bars. Deflected bolts gain speed and damage.
- Fight at burst range and watch the three ring segments vanish one at a time. Three clean bolts delete a
  full-health target; after the third fast shot, feel the 0.45 s recharge before the next burst.
- Hold `Y` through the full charge. The two orbit dots should meet at your front and the beam should fire
  on its own, root you, sweep slowly, and pierce every target in the line while pillars cut it off.
- Tap `Y` at the start of a match to discover your random bug. Try all four: mine, trap, wall shield,
  ghost. Ghost should dim your avatar and let you pass through enemies until you attack.
- Deflect a `DIGITAL` bolt back at it. Higher tiers try to dodge their own armed ricochets.
- Finish a first-to-3 and rematch. Scores reset, the arena choice persists, and bot brains reset.
- Enter the gauntlet on each arena. On `SWITCHBACK`, watch a worm snake through the bars instead of
  stopping at them; on `THE RING`, use a gate to cut a firewall's line.
- Let a worm eat a few viruses. Its chain should grow and its health should recover; cut it down with
  the beam before it reaches the cap.
- Let viruses stack on you until the infection bar fills. A thrall should spawn nearby, chase you, swing
  and shoot, and drop when eliminated.
- Stand in a firewall warning lane, then step behind a pillar. The beam should stop burning you behind
  cover. Take a bolt and a beam tick and check the push and triangle spray direction.
- Open Settings and step through Controls, Feedback, Audio and System. Change hit rotation, impact
  flash, volume and scanlines; test the hit preview; then reset defaults.
- Host a room on a non-default arena, then join from a second tab. The guest must render the host's map.

## Development

```bash
npm run build   # strict typecheck + production PWA build
npm run bench   # headless 60 Hz simulation, 8P bot AI, and gauntlet threat benchmark
npm run icons   # regenerate PWA icons
```

Architecture, invariants, network protocol, and measured performance live in [AGENTS.md](AGENTS.md).
The forward plan and open design questions are in [TODO.md](TODO.md); session-by-session decisions and
verification are in [HISTORY.md](HISTORY.md). The original specification is
[PRD-Deflect_game.md](PRD-Deflect_game.md).
