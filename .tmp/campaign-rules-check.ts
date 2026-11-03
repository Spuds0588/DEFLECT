import { TutorialRunner, WARDEN_TUTORIAL } from '../src/game/tutorial';
import { World } from '../src/game/world';
import { ARENAS } from '../src/game/arenas';
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS } from '../src/game/config';

// 1. The lesson waits for the hands, not the clock.
const t = new TutorialRunner(WARDEN_TUTORIAL);
const idle = { mx: 0, my: 0, held: 0, pressed: 0 };
for (let i = 0; i < 60 * 40; i++) t.update({ dt: 1 / 60, frame: idle, lockActive: false, reflected: false });
console.log('after 40s idle: done=', t.done, 'step=', t.current?.id, 'action=', t.current?.action);
if (t.done) throw new Error('tutorial advanced past a required action with no input');
if (t.current?.action !== 'move') throw new Error('tutorial did not reach the first action step');
for (let i = 0; i < 60 * 3; i++) t.update({ dt: 1 / 60, frame: { mx: 1, my: 0, held: 0, pressed: 0 }, lockActive: false, reflected: false });
console.log('after moving: step=', t.current?.id, '(expected dash)');
if (t.current?.id !== 'dash') throw new Error('tutorial did not advance after the move goal was met');

// 2. Level 1 keeps the floor primitive.
const level = PLAYABLE_CAMPAIGN_LEVELS[0];
const arena = ARENAS.find((a) => a.id === level.arenaId)!;
const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'P';
const w = new World('gauntlet', names, 0, arena, false, 0, 3, [11, 10, 9], true,
  level.dataCrates, false, level.intro, level.clearKills, false, level.boss ?? -1, level.primitivesOnly === true);
(w as any).beginAssault();
const viruses = (w.viruses as any[]).filter((v) => v.active).length;
const worms = (w.worms as any[]).filter((x) => x.active).length;
console.log('level 1 assault: viruses=', viruses, 'worms=', worms, 'primitivesOnly=', (w as any).campaignPrimitivesOnly);
if (viruses !== 0) throw new Error('level 1 spawned viruses despite the primitives-only rule');
if (worms === 0) throw new Error('level 1 spawned no worms: the floor is empty');
