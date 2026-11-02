# INFECTION balance sweep — 2026-11-01

Build 0.1.105, DIGITAL bots, cap 150 s. No gameplay values were changed.

## Method

- **Headless:** `.tmp/infection-balance.ts`; 13 programs × 3 non-damaging maps (GRID ZERO, SWITCHBACK,
  TRANSIT) × 3 bot styles × 5 seeds = 585 runs per arm. Slot 0 is AI-owned so the brain's 0.8× lead and
  projectile speed agree. Friendly fire is off. Pickups are off.
- **Skill arm:** the same 585 runs with a test-only tap that presses Y when the skill is ready and a virus
  is inside 440 units. This is an availability fixture, not an optimal-use controller.
- **Headed:** Chromium against the Vite dev server, GRID ZERO, DIGITAL autopilot, one run per program.
  Six programs were started through the normal `?infection=1&bot=1` boot path; the remaining seven were
  restarted in the live page with the same `World` and `BotBrain`, and the page was allowed to paint
  between runs. No console errors.
- **PvP comparison:** the current build's `.tmp/balance.ts duels 0` (468 ordered 1v1 games) and
  `.tmp/duel4.ts` (260 four-player rounds) on CROSSROADS. This also reproduces the v0.1.89 direction.

## Headless infection — non-damaging maps

| Program | Clear % | Avg s | End % | Kills | Skill-arm clear % | Skill-arm avg s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| COMPRESS | 100.0 | 28.0 | 100.0 | 40.6 | 93.3 | 27.7 |
| WEDGE | 97.8 | 19.7 | 99.9 | 35.5 | 86.7 | 19.6 |
| KABOOM | 97.8 | 24.7 | 99.8 | 38.5 | 93.3 | 23.0 |
| PINBALL | 95.6 | 18.1 | 98.4 | 34.0 | 93.3 | 18.5 |
| PROBE | 93.3 | 25.0 | 99.6 | 38.6 | 97.8 | 21.8 |
| TOXIC | 91.1 | 24.8 | 98.6 | 38.1 | 88.9 | 24.9 |
| SWEEP | 84.4 | 23.5 | 95.6 | 36.3 | 88.9 | 24.0 |
| BAD_LAG | 82.2 | 17.2 | 94.5 | 32.2 | 77.8 | 14.3 |
| GHOST | 80.0 | 41.3 | 94.3 | 46.5 | 80.0 | 60.5 |
| ATOMIZE | 42.2 | 74.4 | 88.8 | 63.9 | 93.3 | 74.3 |
| COPY_PASTA | 37.8 | 22.6 | 82.8 | 31.7 | 40.0 | 43.1 |
| FISHER | 13.3 | 13.2 | 42.9 | 14.4 | 6.7 | 12.5 |
| AIM_BOT | 0.0 | 20.4 | 43.8 | 16.0 | 0.0 | 20.6 |

Overall: **412/585 clears (70.4%)**, 169 deaths, 4 timeouts. Skill arm: **423/585 (72.3%)**, 154 deaths,
8 timeouts. Per-map base clears were 73.3% GRID ZERO, 65.1% SWITCHBACK, 72.8% TRANSIT.

## PvP reference — current build

| Program | 4P FFA win % | 4P top-2 % | 1v1 win % |
| --- | ---: | ---: | ---: |
| ATOMIZE | 53.8 | 72.5 | 66.7 |
| AIM_BOT | 42.5 | 63.8 | 54.2 |
| GHOST | 38.8 | 66.3 | 43.1 |
| COMPRESS | 31.3 | 63.8 | 59.7 |
| TOXIC | 26.3 | 47.5 | 41.0 |
| PINBALL | 25.0 | 60.0 | 69.4 |
| KABOOM | 25.0 | 51.3 | 47.2 |
| FISHER | 18.8 | 40.0 | 51.4 |
| SWEEP | 17.5 | 43.8 | 51.4 |
| COPY_PASTA | 15.0 | 45.0 | 49.3 |
| PROBE | 12.5 | 35.0 | 40.3 |
| BAD_LAG | 8.8 | 32.5 | 41.0 |
| WEDGE | 5.0 | 18.8 | 35.4 |

The v0.1.89 two-seed 4P result (Atomize 50/50, Ghost 47.5/47.5, Aim Bot 35.0/36.3, rest 8.8–33.8)
still describes the current PvP ordering.

## Headed pass — one run per program

| Program | Result | Time | Kills | End | Path |
| --- | --- | ---: | ---: | ---: | --- |
| COMPRESS | CLEAR | 27.1 | 40 | 100% | live page restart |
| WEDGE | CLEAR | 23.4 | 38 | 100% | normal boot |
| KABOOM | CLEAR | 22.1 | 37 | 100% | live page restart |
| PINBALL | CLEAR | 13.5 | 32 | 100% | live page restart |
| PROBE | CLEAR | 30.6 | 42 | 100% | normal boot |
| TOXIC | CLEAR | 22.0 | 37 | 100% | normal boot |
| SWEEP | CLEAR | 26.5 | 40 | 100% | normal boot |
| BAD_LAG | CLEAR | 10.2 | 30 | 100% | live page restart |
| GHOST | CLEAR | 32.3 | 43 | 100% | live page restart |
| ATOMIZE | CLEAR | 28.8 | 41 | 100% | live page restart |
| COPY_PASTA | CLEAR | 15.7 | 33 | 100% | live page restart |
| FISHER | FAIL | 13.1 | 12 | 37.5% | normal boot |
| AIM_BOT | FAIL | 15.0 | 12 | 36.4% | normal boot |

Toxic also failed once in the in-page batch (13.1 s, 71.9%) and cleared on the normal boot (22.0 s), which
is a useful reminder that one browser run is a smoke test, not a rate.

## Read

- **PvP form does not transfer to infection.** The 4P win-rate rank correlates weakly and negatively with
  infection clear rate (Spearman −0.25). Aim Bot is second in 4P but last here; Atomize is first in 4P but
  tenth here; Wedge is last in 4P but second here; Bad Lag and Probe move from the PvP basement to the
  infection top half.
- **Single-target overkill is a liability.** Aim Bot's 5-damage rail still spends a 2.8 s reload to delete
  one 1-HP virus; it fails 0/45 headless runs and 0/15 with auto-skills. Its progress improves from 43.8%
  to 54.8% with skill taps, but it still never closes. Fisher's slow spear has the same problem in a
  different shape: 13.3% base, 6.7% with skill taps.
- **Sustain and crowd clear win.** Compress (100%), Wedge (97.8%), Kaboom (97.8%) and Pinball (95.6%)
  lead. Kaboom's blasts, Wedge's triple string, Pinball's long-lived ball and Compress's six-segment hull
  plus burst all convert better against a 1-HP swarm than precision dueling does.
- **Atomize is reliable only with the shield skill.** 42.2% base but 93.3% with auto-taps, at essentially
  the same 74 s clear time. The six-segment hull alone is not enough; the orbiting balls are the
  survival tool.
- **Copy Pasta is the unresolved middle.** 37.8% base and 40.0% with skill taps; neither the file split nor
  the clone turns the corner. Fisher and Aim Bot are the clear bottom two.

## Caveats

- The test pilot is the local `BotBrain`, not a human. In the gauntlet path it does not tap most Y skills
  and does not use dashes; the skill arm is a crude on-cooldown tap, not good skill usage. These numbers
  are a **basic-kit** balance read, not a full-kit verdict.
- The headed pass uses one sample per program and one arena. It confirms the direction and the browser
  path, not the percentages.
- Hazard arenas were excluded from the matrix. CROSSROADS emitters contributed kills in the opening
  one-map sample; only GRID ZERO, SWITCHBACK and TRANSIT were used for the full run.
- No health, damage, cooldown or tuning values were changed. A human infection pass on Aim Bot, Fisher,
  Atomize and Copy Pasta is the next decision point.
