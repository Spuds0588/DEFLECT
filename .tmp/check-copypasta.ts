import { ARENAS } from '../src/game/arenas';
import { MAX_PLAYERS, PLAYER } from '../src/game/config';
import { PROGRAM_ID } from '../src/game/programs';
import { ACTION } from '../src/game/types';
import { World } from '../src/game/world';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`ok   ${name}${detail ? `  (${detail})` : ''}`);
    return;
  }
  failures++;
  console.log(`FAIL ${name}${detail ? `  (${detail})` : ''}`);
}

const inputs: (null | { mx: number; my: number; held: number; pressed: number })[] = new Array(MAX_PLAYERS).fill(null);

function twoPlayerWorld(mode: 'training' | 'match' = 'training'): World {
  const w = new World(mode, ['QA', 'DUMMY'], 0, ARENAS[0], false, PROGRAM_ID.COPYPASTA, 0);
  const p = w.players[0];
  const t = w.players[1];
  p.x = 400;
  p.y = 300;
  p.facing = 0;
  p.energy = PLAYER.energyMax;
  p.hp = 3;
  p.bugKind = 14;
  t.active = true;
  t.connected = true;
  t.alive = true;
  t.slot = 1;
  t.program = PROGRAM_ID.PROBE;
  t.hp = 99;
  t.maxHp = 99;
  t.x = 520;
  t.y = 300;
  t.facing = Math.PI;
  return w;
}

// --- Ranged: one file tears into two children, and children stop the chain. -------
{
  const w = twoPlayerWorld();
  const p = w.players[0];
  inputs[0] = { mx: 0, my: 0, held: ACTION.BOLT, pressed: ACTION.BOLT };
  for (let i = 0; i < 14; i++) w.step(1 / 60, inputs);
  check('ranged fired', p.energy < PLAYER.energyMax, `energy ${p.energy.toFixed(1)}`);
  const children = w.projectiles.filter((x) => x.active && x.type === 16 && x.variant === 1);
  check('two children on hit', children.length === 2, String(children.length));
  check('target took one file', w.players[1].hp === 98, String(w.players[1].hp));
  if (children.length > 0) {
    const before = w.projectiles.filter((x) => x.active && x.type === 16).length;
    (w as unknown as { splitCopyShot: (p: object) => void }).splitCopyShot(children[0]);
    const after = w.projectiles.filter((x) => x.active && x.type === 16).length;
    check('children do not chain', before === after, `${before} -> ${after}`);
  }
  inputs[0] = null;
}

// --- Skill: a copy body spawns, fights, is excluded from counts and expires. ------
{
  const w = twoPlayerWorld();
  const p = w.players[0];
  const t = w.players[1];
  (w as unknown as { useBug: (p: object) => void }).useBug(p);
  const clone = w.players[MAX_PLAYERS - 1];
  check('copy spawned', clone.active && clone.copyClone, `slot ${clone.slot}`);
  check('copy is not a room body', w.activeCount() === 2 && w.aliveCount() === 2, `${w.activeCount()}/${w.aliveCount()}`);
  check('copy owns a normal kit', clone.program === PROGRAM_ID.COPYPASTA && clone.bugKind === 14);
  const startX = clone.x;
  for (let i = 0; i < 90; i++) w.step(1 / 60, inputs);
  check('copy moves and fights', Math.abs(clone.x - startX) > 4 || t.hp < 99, `x ${clone.x.toFixed(1)} hp ${t.hp}`);
  check('copy still out of counts', w.activeCount() === 2);
  for (let i = 0; i < 500; i++) {
    t.hp = 99;
    w.step(1 / 60, inputs);
  }
  check('copy expires', !clone.active && !clone.copyClone, `t ${clone.copyT.toFixed(2)}`);
}

// --- Heavy: marks grow, then pay 2 to a body. -------------------------------------
{
  const w = twoPlayerWorld();
  const p = w.players[0];
  const t = w.players[1];
  const cast = w as unknown as { fireCopyRedaction: (p: object) => void };
  cast.fireCopyRedaction(p);
  check('redaction spends the heavy', p.energy === PLAYER.energyMax - 55 && p.laserCd > 9, `energy ${p.energy} cd ${p.laserCd}`);
  const mark = w.copyMarks.find((m) => m.active);
  check('target marked', !!mark && mark.kind === 0 && mark.id === 1, mark ? `kind ${mark.kind} id ${mark.id}` : 'none');
  for (let i = 0; i < 48; i++) w.step(1 / 60, inputs);
  check('mark grows', !!mark && mark.count > 1, mark ? String(mark.count) : 'none');
  for (let i = 0; i < 60; i++) w.step(1 / 60, inputs);
  check('mark detonates for 2', t.hp === 97, String(t.hp));
  check('mark clears', w.copyMarks.every((m) => !m.active));
}

// --- Cover and allies: a pillar blocks the cast, the copy is never marked. --------
{
  const arena = ARENAS[0];
  const pillar = arena.pillars[0];
  if (pillar) {
    const w = twoPlayerWorld();
    const p = w.players[0];
    const t = w.players[1];
    p.x = pillar.x - 55;
    p.y = pillar.y + pillar.h * 0.5;
    t.x = pillar.x + pillar.w + 55;
    t.y = p.y;
    (w as unknown as { fireCopyRedaction: (p: object) => void }).fireCopyRedaction(p);
    check('cover blocks redaction', w.copyMarks.every((m) => !m.active));
    check('cover target untouched', t.hp === 99, String(t.hp));
  }

  const w = twoPlayerWorld();
  const p = w.players[0];
  (w as unknown as { useBug: (p: object) => void }).useBug(p);
  (w as unknown as { fireCopyRedaction: (p: object) => void }).fireCopyRedaction(p);
  check('copy never marked', w.copyMarks.every((m) => !(m.active && m.kind === 0 && m.id === MAX_PLAYERS - 1)));
  check('owner never marked', w.copyMarks.every((m) => !(m.active && m.kind === 0 && m.id === 0)));
}

console.log(failures === 0 ? '\nALL CHECKS PASS' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
