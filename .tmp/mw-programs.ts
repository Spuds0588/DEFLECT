/**
 * Every program vs the Mega Worm: does each kit actually kill the boss, and how long
 * does it take with an invulnerable pilot that only fires and keeps its distance.
 */
import { MAX_PLAYERS, MEGA_WORM, SIM_DT } from '../src/game/config';
import { ARENAS } from '../src/game/arenas';
import { MINIBOSS } from '../src/game/minibosses';
import { PROGRAMS } from '../src/game/programs';
import { World } from '../src/game/world';

const arena = ARENAS.find((a) => a.id === 1)!;
const b = arena.bounds;
const inArena = (x: number, y: number, pad = 200) =>
  x > b.left - pad && x < b.right + pad && y > b.top - pad && y < b.bottom + pad;

function run(program: number) {
  const names = new Array<string>(MAX_PLAYERS).fill('');
  names[0] = 'PILOT';
  const world = new World('gauntlet', names, 0, arena, false, program, 0, null, true, [], false, 'none', 0, false, MINIBOSS.MEGA_WORM);
  const priv = world as any;
  priv.tutorial = null;
  priv.campaignPhase = 'assault';
  priv.campaignBossSpawned = true;
  priv.spawnMiniboss(MINIBOSS.MEGA_WORM, world.centerX + 260, world.centerY - 80);
  const frames = new Array(MAX_PLAYERS).fill(null).map(() => ({ mx: 0, my: 0, held: 0, pressed: 0 }));
  const p = world.players[0];
  const cx = world.centerX;
  const cy = world.centerY;
  let t = 0;
  let lowHp = MEGA_WORM.headHp + MEGA_WORM.segments * MEGA_WORM.hpPerSegment;
  const maxTicks = Math.round(240 / SIM_DT);
  while (t < maxTicks) {
    p.iframes = 999;
    const boss = world.worms.find((w) => w.active && w.bossKind === MINIBOSS.MEGA_WORM);
    if (!boss) break;
    lowHp = Math.min(lowHp, boss.hp);
    const dx = boss.x - p.x;
    const dy = boss.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    frames[0].held = 2 | 16;
    if (!inArena(boss.x, boss.y)) {
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
    world.step(SIM_DT, frames);
    t++;
  }
  const alive = world.worms.some((w) => w.active && w.bossKind === MINIBOSS.MEGA_WORM);
  return { cleared: !alive, secs: +(t * SIM_DT).toFixed(1), lowHp: Math.round(lowHp) };
}

for (let i = 0; i < PROGRAMS.length; i++) {
  const name = PROGRAMS[i].name;
  console.log(`${i} ${name} ${JSON.stringify(run(i))}`);
}
