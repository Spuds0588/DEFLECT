/**
 * Real-input campaign aggro probe. This locks a companion with the ordinary
 * ACTION.LOCK frame, fires a real ranged shot from the player and checks that the
 * companion turns hostile. The old probe forced `lockActive`, which hid input bugs.
 */
import { ARENAS } from '../src/game/arenas';
import { ACTION, type InputFrame } from '../src/game/types';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';
import { World } from '../src/game/world';

const fail = (message: string): never => {
  throw new Error(message);
};

const arena = ARENAS[0] ?? fail('arena 0 is missing');
const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'HUMAN';
names[1] = 'BOT-1';
const world = new World('gauntlet', names, 0, arena, false, 0, 1, null, true, [], false, 'none', 999, false, -1) as any;
world.tutorial = null;
world.campaignPhase = 'assault';
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
const frame = (held: number, pressed: number): InputFrame => ({ mx: 0, my: 0, held, pressed });
const frames: (InputFrame | null)[] = new Array(MAX_PLAYERS).fill(null);
frames[0] = frame(ACTION.LOCK, 0);
for (let i = 0; i < 30; i++) world.step(SIM_DT, frames);
console.log('lock after input:', p.lockActive, p.lockKind, p.lockId, 'bot hp', bot.hp, 'iframes', bot.iframes);
if (!p.lockActive || p.lockKind !== 1 || p.lockId !== 1) fail('real lock input did not lock the companion');

frames[0] = frame(ACTION.LOCK, ACTION.BOLT);
world.step(SIM_DT, frames);
frames[0] = frame(ACTION.LOCK, 0);
for (let i = 0; i < 30; i++) world.step(SIM_DT, frames);
console.log('after shot:', 'bot hp', bot.hp, 'aggro', world.campaignAllyHostile(1), 'player lock', p.lockActive, p.lockKind, p.lockId);
if (world.players[1].hp >= 3) fail('the locked shot did not damage the companion');
if (!world.campaignAllyHostile(1)) fail('a real locked shot did not turn the companion hostile');
// Melee drops lockActive for the swing; the retained intent must still turn the bot.
const meleeWorld = new World('gauntlet', names, 0, arena, false, 0, 1, null, true, [], false, 'none', 999, false, -1) as any;
meleeWorld.tutorial = null;
meleeWorld.campaignPhase = 'assault';
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
const meleeFrames: (InputFrame | null)[] = new Array(MAX_PLAYERS).fill(null);
meleeFrames[0] = frame(ACTION.LOCK, 0);
for (let i = 0; i < 30; i++) meleeWorld.step(SIM_DT, meleeFrames);
if (!mp.lockActive || mp.lockKind !== 1 || mp.lockId !== 1) fail('melee setup did not lock the companion');
meleeFrames[0] = frame(ACTION.LOCK, ACTION.SWING);
meleeWorld.step(SIM_DT, meleeFrames);
meleeFrames[0] = frame(ACTION.LOCK, 0);
for (let i = 0; i < 30; i++) meleeWorld.step(SIM_DT, meleeFrames);
console.log('after melee:', 'bot hp', mb.hp, 'aggro', meleeWorld.campaignAllyHostile(1), 'intent', mp.lockIntentSlot, mp.lockIntentT);
if (mb.hp >= 3) fail('the locked melee hit did not damage the companion');
if (!meleeWorld.campaignAllyHostile(1)) fail('a locked melee hit did not turn the companion hostile');

console.log('ally-real-check: OK');
