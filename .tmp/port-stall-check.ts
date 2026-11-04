import { World } from '../src/game/world';
import { ARENAS } from '../src/game/arenas';
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { BotBrain } from '../src/game/bot';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';

const level = PLAYABLE_CAMPAIGN_LEVELS[0];
const arena = ARENAS.find((a) => a.id === level.arenaId)!;
const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'PILOT';
for (let i = 1; i <= 3; i++) names[i] = `BOT${i}`;
const world = new World(
  'gauntlet', names, 0, arena, false, 0, 3, [11, 10, 9], true,
  level.dataCrates, false, level.intro, level.clearKills, false, level.boss ?? -1,
);
const priv = world as any;
const brains: (BotBrain | null)[] = new Array(MAX_PLAYERS).fill(null);
brains[0] = new BotBrain(0, 'impossible', 0, 12345);
for (let i = 1; i < MAX_PLAYERS; i++) brains[i] = new BotBrain(i, 'digital', i - 1, 54321 + i * 131);
const frames: any[] = new Array(MAX_PLAYERS).fill(null).map(() => ({ mx: 0, my: 0, held: 0, pressed: 0 }));
const p = world.players[0];
let t = 0;
let next = 0;
let exitReadyAt = -1;
const portalFirst = new Map<any, string>();
while (t < 200 && world.campaignPhase !== 'cleared') {
  if (priv.tutorial && !priv.tutorial.done) world.skipTutorial();
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const b = brains[i];
    const pl = world.players[i];
    if (b && pl && pl.active && pl.alive) b.think(world, frames[i], SIM_DT);
  }
  world.step(SIM_DT, frames);
  t += SIM_DT;
  if (world.campaignExitReady && exitReadyAt < 0) exitReadyAt = t;
  if (t >= next) {
    next += 5;
    if (world.campaignPhase === 'assault' || world.campaignPhase === 'cleared' || world.campaignPhase === 'failed') {
      const portals = (world.props as any[]).filter((pr) => pr.portal && !pr.portalExit);
      for (const pr of portals) {
        const cx = Math.round(pr.x + pr.w * 0.5);
        const cy = Math.round(pr.y + pr.h * 0.5);
        if (!portalFirst.has(pr)) portalFirst.set(pr, `${cx},${cy} hp${pr.portalMaxHp}`);
      }
      const desc = portals.map((pr) => {
        const cx = Math.round(pr.x + pr.w * 0.5);
        const cy = Math.round(pr.y + pr.h * 0.5);
        const d = Math.round(Math.hypot(cx - p.x, cy - p.y));
        return `[${cx},${cy} hp${Math.round(pr.hp)}/${pr.portalMaxHp} d${d}]`;
      }).join(' ');
      console.log(`t=${t.toFixed(0)} ${world.campaignPhase} hp${p.hp} steer=${(brains[0] as any)?.steerBranch ?? '-'} closed=${world.portsClosed}/${world.portTotal} exit=${world.campaignExitReady} kills=${world.gauntletKills} p=${Math.round(p.x)},${Math.round(p.y)} ${desc}`);
    }
  }
}
console.log('END', world.campaignPhase, 'closed', world.portsClosed, '/', world.portTotal, 'exitReadyAt', exitReadyAt, 'kills', world.gauntletKills, 't', Math.round(t));
