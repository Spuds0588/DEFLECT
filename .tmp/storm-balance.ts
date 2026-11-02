/** Storm Cloud balance: a HARD bot pilot fights it alone; report time, damage and boss health. */
import { SIM_DT, STORM_CLOUD } from '../src/game/config';
import { MINIBOSS } from '../src/game/minibosses';
import { BotBrain, type BotTier } from '../src/game/bot';
import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';
import { ACTION, type InputFrame } from '../src/game/types';

const arena = ARENAS.find((a) => a.id === 22) ?? ARENAS[0];
const CAP = 75;
const tier = (process.env.TIER ?? 'digital') as BotTier;
const PROGRAMS = [0, 4, 7];

interface Row {
  program: number;
  style: number;
  seconds: number;
  stormHp: number;
  playerHp: number;
  deaths: number;
  hits: number;
  drops: number;
  bolts: number;
  guards: number;
}

function runOne(program: number, style: number, seed: number): Row {
  const world = new World('gauntlet', ['PILOT'], -1, arena, false, program);
  const priv = world as any;
  for (const w of world.worms) w.active = false;
  for (const v of world.viruses) v.active = false;
  for (const s of world.sentries) s.active = false;
  for (const e of world.errors) e.active = false;
  const p = world.players[0];
  p.x = (arena.bounds.left + arena.bounds.right) * 0.5;
  p.y = (arena.bounds.top + arena.bounds.bottom) * 0.55;
  p.alive = true;
  p.iframes = 0;
  p.cloakT = 0;
  const storm = priv.spawnMiniboss(MINIBOSS.STORM_CLOUD, p.x, p.y - 300);
  if (!storm) throw new Error('storm never spawned');
  storm.spawnT = 0;
  storm.storm.boltCd = 2;
  priv.tickAssault = () => {};

  const brain = new BotBrain(0, tier, style, seed);
  const input: InputFrame = { mx: 0, my: 0, held: 0, pressed: 0 };
  let t = 0;
  let hits = 0;
  let drops = 0;
  let bolts = 0;
  let guards = 0;
  const seen = new Set<number>();
  let lastHp = p.hp;
  while (t < CAP && p.alive && storm.active) {
    brain.think(world, input, SIM_DT);
    world.step(SIM_DT, [input]);
    t += SIM_DT;
    if ((input.held & ACTION.SWING) !== 0) guards++;
    if (p.hp < lastHp) hits++;
    lastHp = p.hp;
    for (const q of world.projectiles) {
      if (!q.active || seen.has(q.serial) || q.owner !== -1) continue;
      seen.add(q.serial);
      if (q.type === 18) drops++;
      if (q.type === 19) bolts++;
    }
    input.pressed = 0;
  }
  return {
    program,
    style,
    seconds: Math.round(t * 10) / 10,
    stormHp: Math.round((storm.active ? storm.hp / STORM_CLOUD.hp : 0) * 100),
    playerHp: p.hp,
    deaths: p.alive ? 0 : 1,
    hits,
    drops,
    bolts,
    guards,
  };
}

const rows: Row[] = [];
for (const program of PROGRAMS) {
  for (let style = 0; style < 3; style++) {
    rows.push(runOne(program, style, 0x51f15e + program * 977 + style * 131));
  }
}
for (const r of rows) console.log(JSON.stringify(r));
const dead = rows.filter((r) => r.deaths).length;
const avgHp = Math.round(rows.reduce((s, r) => s + r.stormHp, 0) / rows.length);
const avgTime = Math.round((rows.reduce((s, r) => s + r.seconds, 0) / rows.length) * 10) / 10;
const avgDrops = Math.round(rows.reduce((s, r) => s + r.drops, 0) / rows.length);
const avgBolts = Math.round(rows.reduce((s, r) => s + r.bolts, 0) / rows.length);
console.log(JSON.stringify({ tier, avgHp, avgTime, avgDrops, avgBolts, dead, runs: rows.length }));
