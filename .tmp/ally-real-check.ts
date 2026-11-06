/**
 * Real-input campaign alliance probe. Locks a companion with ACTION.LOCK, fires a real
 * ranged shot, then runs the real brain. The campaign rule means the shot does not
 * damage the companion and the companion never turns, regardless of lock intent.
 */
import { ARENAS } from '../src/game/arenas';
import { ACTION, type InputFrame } from '../src/game/types';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';
import { BotBrain } from '../src/game/bot';
import { World } from '../src/game/world';

const fail = (message: string): never => {
  throw new Error(message);
};

const arena = ARENAS[0] ?? fail('arena 0 is missing');
const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'HUMAN';
names[1] = 'BOT-1';
const world = new World('gauntlet', names, 0, arena, false, 0, 1, null, true, [], false, 'assault', 999, false, -1) as any;
world.tutorial = null;
world.phase = 'practice';
const p = world.players[0];
const bot = world.players[1];
const cx = (arena.bounds.left + arena.bounds.right) * 0.5;
const cy = (arena.bounds.top + arena.bounds.bottom) * 0.5;
p.x = cx - 140;
p.y = cy;
p.prevX = p.x;
p.prevY = p.y;
bot.x = cx + 80;
bot.y = cy;
bot.prevX = bot.x;
bot.prevY = bot.y;
const brain = new BotBrain(1, 'veteran', 0, 0xabc);
const frame = (held: number, pressed: number): InputFrame => ({ mx: 0, my: 0, held, pressed });
const frames: (InputFrame | null)[] = new Array(MAX_PLAYERS).fill(null);
frames[0] = frame(ACTION.LOCK, 0);
for (let i = 0; i < 30; i++) world.step(SIM_DT, frames);
if (!p.lockActive || p.lockKind !== 1 || p.lockId !== 1) fail('real lock input did not lock the companion');

frames[0] = frame(ACTION.LOCK, ACTION.BOLT);
world.step(SIM_DT, frames);
frames[0] = frame(ACTION.LOCK, 0);
for (let i = 0; i < 30; i++) {
  world.step(SIM_DT, frames);
  brain.think(world, frames[0]!, SIM_DT);
}
console.log('after locked shot:', 'bot hp', bot.hp, 'target', (brain as any).target);
if (bot.hp !== 3) fail(`campaign friendly fire damaged the companion (${bot.hp}/3)`);
if ((brain as any).target !== -1) fail(`companion aggroed after a locked shot (${(brain as any).target})`);

// A locked melee press also must not flip the companion.
const meleeWorld = new World('gauntlet', names, 0, arena, false, 0, 1, null, true, [], false, 'assault', 999, false, -1) as any;
meleeWorld.tutorial = null;
meleeWorld.phase = 'practice';
const mp = meleeWorld.players[0];
const mb = meleeWorld.players[1];
mp.x = cx - 40;
mp.y = cy;
mp.prevX = mp.x;
mp.prevY = mp.y;
mb.x = cx + 20;
mb.y = cy;
mb.prevX = mb.x;
mb.prevY = mb.y;
const meleeBrain = new BotBrain(1, 'veteran', 0, 0xdef);
mp.x = cx - 80;
mp.y = cy;
mp.prevX = mp.x;
mp.prevY = mp.y;
mb.x = cx;
mb.y = cy;
mb.prevX = mb.x;
mb.prevY = mb.y;
const meleeFrames: (InputFrame | null)[] = new Array(MAX_PLAYERS).fill(null);
meleeFrames[0] = frame(ACTION.LOCK, 0);
// Acquire the lock before the brain starts steering the companion.
for (let i = 0; i < 30; i++) meleeWorld.step(SIM_DT, meleeFrames);
if (!mp.lockActive || mp.lockKind !== 1 || mp.lockId !== 1) fail('melee setup did not lock the companion');
meleeFrames[0] = frame(ACTION.LOCK, ACTION.SWING);
meleeWorld.step(SIM_DT, meleeFrames);
meleeFrames[0] = frame(ACTION.LOCK, 0);
for (let i = 0; i < 30; i++) {
  meleeWorld.step(SIM_DT, meleeFrames);
  meleeBrain.think(meleeWorld, meleeFrames[0]!, SIM_DT);
}
console.log('after locked melee:', 'bot hp', mb.hp, 'target', (meleeBrain as any).target);
if (mb.hp !== 3) fail(`campaign friendly fire let a melee hit through (${mb.hp}/3)`);
if ((meleeBrain as any).target !== -1) fail(`companion aggroed after a locked melee hit (${(meleeBrain as any).target})`);

console.log('ally-real-check: OK (real shot and melee never damage or turn a campaign ally)');
