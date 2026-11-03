/** Minimal, honest check: does ordinary ranged fire damage a campaign port on clear floor? */
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';
import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';
import { ACTION } from '../src/game/types';

const level = PLAYABLE_CAMPAIGN_LEVELS[0];
const arena = ARENAS.find((a) => a.id === level.arenaId)!;
const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'PORT';
const world = new World('gauntlet', names, 0, arena, false, 0, 0, null, true, level.dataCrates, false, level.intro, level.clearKills, false, -1);
const priv = world as any;
priv.tutorial = null;
priv.campaignPhase = 'assault';
priv.beginAssault();
const ports = (world.props as any[]).filter((q) => q.portal && q.active);
console.log('ports:', ports.map((q) => `${q.x},${q.y} hp=${q.hp}`).join(' | '));
const port = ports[0];
const p = world.players[0];
p.iframes = 1e9;
// stand 175 units west of the port centre, face east, hold fire
p.x = port.x - 175; p.y = port.y; p.facing = 0;
const hp0 = port.hp;
const frames = new Array(MAX_PLAYERS).fill(null);
frames[0] = { mx: 1, my: 0, held: ACTION.BOLT, pressed: 0 };
let closest = 1e9;
for (let i = 0; i < 240 && port.active; i++) {
  frames[0] = { mx: 0, my: 0, held: ACTION.BOLT, pressed: 0 };
  world.step(SIM_DT, frames);
  for (const q of world.projectiles) if (q.active && q.owner === 0) closest = Math.min(closest, Math.hypot(q.x - port.x, q.y - port.y));
}
console.log(`port0 hp ${hp0} -> ${port.hp} active=${port.active} closestBolt=${closest.toFixed(1)} playerX=${Math.round(p.x)}`);
