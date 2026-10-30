# Tuning data

Every feel, timing and damage number lives here. `src/game/config.ts` imports these records, adds the few
values derived from view geometry, and re-exports them under the old names, so systems import from
`config.ts` and never from JSON.

Edit a value and save: a running `npm run dev` hot-reloads it. A production build bakes the numbers in;
there is no runtime fetch, which keeps snapshots, bot determinism and the PWA cache unchanged.

## Files

| File | Owns |
| --- | --- |
| `player.json` | Avatar movement, health, energy, dash, melee, guard, target lock, heavy beam, `BOLT`, `BUG`, `MINE` |
| `programs.json` | `WEDGE`, `FISHER`, `SWEEP`, `TOXIC`, `KABOOM`, `BUFFER`, `ATOMIZE` kits |
| `threats.json` | `GAUNTLET` wave pacing, `WORM`, `VIRUS`, `SENTRY`, `CASCADING_ERROR`, `THRALL`, `FIREWALL` |
| `campaign.json` | `CAMPAIGN` node pacing, drill/breach beat and score weights |
| `world.json` | `CAMERA`, `FALL`, `FILE_PROP`, `ARENA`, `TRAVERSE`, `EMITTER`, `POWERUP`, `ROUND`, `TRAINING`, `NET`, `ATTRACT` |

## Units

- Distances are virtual pixels in the 1280x720 view.
- Times are seconds; rates named `*Rate` or `*Follow` are per second.
- Angles are radians. `Math.PI / 2` is a half-sector; 0.65 rad is about 37 degrees.
- Speeds are units per second. Energy costs are the 0-100 energy pool.
- `zoomMin`/`zoomMax` are multipliers of the base camera zoom, not absolute zoom levels.

## Not here on purpose

- `PLAYER.swingHalfAngle` and `PLAYER.guardHalfAngle` are `PI/2` in `config.ts`, so the 180 degree
  sector stays readable and exact.
- `SWEEP.powerRise` and `SWEEP.powerSpan` derive from `VIEW_H`/`VIEW_W` and `CAMERA_ZOOM` in
  `config.ts`, so a camera change keeps the broom's screen coverage.
- Engine limits (`MAX_PLAYERS`, `SIM_HZ`, pool sizes), the view size and the render palette are in
  `config.ts`; they are not feel knobs.

## Rules that are not numbers

Keep gameplay invariants in `AGENTS.md` and in the system code, not in this folder. The ones easiest to
break while tuning:

- Bomb types 8 and 9 are never deflectable; every deflect/guard branch must exclude them.
- A guard reflection leaves at `PLAYER.laserReflectAngle` and never returns to the caster.
- Arena emitters are local gauntlet/training hazards; a hosted match never arms them. Their guard return
  follows the guard's facing, not `PLAYER.laserReflectAngle` (D27).
- Health-segment hulls must clear the core mark (see D4); do not shrink a `coreScale` to fit a bigger
  number. Atomize's orbit hull keeps its inner edge at `0.55r`; do not narrow the ovals.
- Atomize's type 11 electron uses `homing` as its own seek flag. Only type 0 runs the PATHFIND powerup's
  `steerPathBolt` axis search.
- Bot kits use the human `InputFrame` path; there is no second control path for tuning.
