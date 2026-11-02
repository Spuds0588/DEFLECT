/**
 * Campaign level 2: the REBOOT node runs its assault, then the Mega Worm arrives and the
 * level clears only when it dies. Three seeded runs with three bot companions exercise
 * the route; the pilot is kept invulnerable so the probe measures the boss, not a
 * one-life survival run.
 */
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';
import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';
import type { Worm } from '../src/game/types';

const fail = (m: string): never => {
  throw new Error(m);
};

const level = PLAYABLE_CAMPAIGN_LEVELS.find((l) => l.boss !== undefined);
if (!level) fail('no campaign level authors a boss');
const arena = ARENAS.find((a) => a.id === level.arenaId);
if (!arena) fail(`level 2 arena ${level.arenaId} is missing`);

const inArena = (x: number, y: number, pad = 200) =>
  x > arena.bounds.left - pad &&
  x < arena.bounds.right + pad &&
  y > arena.bounds.top - pad &&
  y < arena.bounds.bottom + pad;

function frame() {
  return { mx: 0, my: 0, held: 0, pressed: 0 };
}

for (let run = 0; run < 3; run++) {
  const names = new Array<string>(MAX_PLAYERS).fill('');
  names[0] = `PILOT${run + 1}`;
  for (let i = 1; i <= 3; i++) names[i] = `SQUAD${i}`;
  const world = new World(
    'gauntlet',
    names,
    0,
    arena,
    false,
    run % 4,
    3,
    null,
    true,
    level.dataCrates,
    false,
    level.intro,
    level.clearKills,
    false,
    level.boss ?? -1,
  );
  const priv = world as any;
  priv.tutorial = null;
  priv.campaignPhase = 'assault';
  priv.beginAssault();
  priv.gauntletKills = world.campaignKillsToClear;
  const frames = new Array(MAX_PLAYERS).fill(null).map(frame);
  const p = world.players[0];
  const cx = (arena.bounds.left + arena.bounds.right) * 0.5;
  const cy = (arena.bounds.top + arena.bounds.bottom) * 0.5;

  let bossSeen = false;
  let ticks = 0;
  let nextLog = 30 / SIM_DT;
  const maxTicks = Math.round(180 / SIM_DT);
  while (ticks++ < maxTicks && world.campaignPhase !== 'cleared') {
    p.iframes = 999;
    const boss = world.worms.find((w) => w.active && w.bossKind === level.boss) as Worm | undefined;
    if (boss) {
      bossSeen = true;
      const dx = boss.x - p.x;
      const dy = boss.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      frames[0].held = 2 | 16;
      if (!inArena(boss.x, boss.y)) {
        // Do not chase a worm that is off the floor: hold the middle and shoot it as it
        // crosses. This is what a player does instead of standing against the wall.
        const mx = cx - p.x;
        const my = cy - p.y;
        const md = Math.hypot(mx, my) || 1;
        if (md > 60) {
          frames[0].mx = mx / md;
          frames[0].my = my / md;
        }
      } else if (d > 320) {
        frames[0].mx = dx / d;
        frames[0].my = dy / d;
      } else if (d < 220) {
        frames[0].mx = -dx / d;
        frames[0].my = -dy / d;
      } else {
        frames[0].mx = (-dy / d) * 0.5;
        frames[0].my = (dx / d) * 0.5;
      }
    } else {
      frames[0].held = 0;
    }
    world.step(SIM_DT, frames);
    if (ticks >= nextLog) {
      const boss = world.worms.find((w) => w.active && w.bossKind === level.boss);
      console.log(
        JSON.stringify({
          run: run + 1,
          at: +(ticks * SIM_DT).toFixed(0),
          phase: world.campaignPhase,
          spawned: priv.campaignBossSpawned,
          boss: boss ? { hp: Math.round(boss.hp), fly: boss.flyPhase, x: Math.round(boss.x) } : null,
        }),
      );
      nextLog += 30 / SIM_DT;
    }
    if (world.gauntletOver && world.campaignPhase !== 'cleared') {
      fail(`run ${run + 1} ended early in phase ${world.campaignPhase}`);
    }
  }
  if (!bossSeen) fail(`run ${run + 1} never spawned the campaign boss`);
  if (world.campaignPhase !== 'cleared') fail(`run ${run + 1} did not clear in 180s`);
  if (!world.gauntletOver) fail(`run ${run + 1} cleared without freezing the arena`);
  console.log(JSON.stringify({ run: run + 1, seconds: +(ticks * SIM_DT).toFixed(1), phase: world.campaignPhase }));
}

console.log(`campaign2-check: OK (${level.name} // boss ${level.boss})`);
