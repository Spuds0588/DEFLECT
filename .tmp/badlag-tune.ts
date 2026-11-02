/**
 * Temporary Bad Lag tuning probe. Health is fixed at the program's three segments;
 * every variant changes only speed, cadence, damage, or time-window timing.
 */
import { ARENAS, type ArenaDef } from '../src/game/arenas';
import { BotBrain, type BotTier } from '../src/game/bot';
import { BUFFER, BUG, SIM_DT } from '../src/game/config';
import { PROGRAM_ID, PROGRAMS } from '../src/game/programs';
import { World } from '../src/game/world';
import { ACTION, type InputFrame } from '../src/game/types';

const BAD_LAG = PROGRAM_ID.BUFFER;
const BAD_LAG_HP = PROGRAMS.find((p) => p.id === BAD_LAG)?.healthSegments ?? 3;
if (BAD_LAG_HP !== 3) throw new Error(`Bad Lag must have 3 health segments, got ${BAD_LAG_HP}`);
const TIER: BotTier = 'digital';
const CAP = Number(process.env.BALANCE_CAP ?? 100);
const DUEL_MAP = ARENAS[0];
const GAUNTLET_MAPS = [ARENAS[1], ARENAS[7], ARENAS[9]];

function frame(): InputFrame {
  return { mx: 0, my: 0, held: 0, pressed: 0 };
}

interface Duel {
  wins: number;
  games: number;
  seconds: number;
  dmgFor: number;
  dmgAgainst: number;
}

function runRound(a: number, b: number, style: number, seed: number, arena: ArenaDef): {
  winner: number;
  seconds: number;
  dmg0: number;
  dmg1: number;
} {
  const w = new World('match', ['A', 'B'], -1, arena, false, a, 1, [a, b]);
  const brains = [
    new BotBrain(0, TIER, style, seed),
    new BotBrain(1, TIER, (style + 1) % 3, seed ^ 0x9e37),
  ];
  const inputs = [frame(), frame()];
  let t = 0;
  let dmg0 = 0;
  let dmg1 = 0;
  let last0 = w.players[0].hp;
  let last1 = w.players[1].hp;
  while (t < 50) {
    if (w.phase === 'live') {
      brains[0].think(w, inputs[0], SIM_DT);
      brains[1].think(w, inputs[1], SIM_DT);
    } else {
      inputs[0].pressed = 0;
      inputs[1].pressed = 0;
    }
    w.step(SIM_DT, inputs);
    w.clearEvents();
    const p0 = w.players[0];
    const p1 = w.players[1];
    if (p1.hp < last1) dmg0 += last1 - p1.hp;
    if (p0.hp < last0) dmg1 += last0 - p0.hp;
    last0 = p0.hp;
    last1 = p1.hp;
    t += SIM_DT;
    if (w.phase === 'roundover') break;
  }
  return { winner: w.roundWinner, seconds: t, dmg0, dmg1 };
}

function duels(): Duel {
  const out: Duel = { wins: 0, games: 0, seconds: 0, dmgFor: 0, dmgAgainst: 0 };
  for (const other of PROGRAMS) {
    if (other.id === BAD_LAG) continue;
    for (let side = 0; side < 2; side++) {
      for (let sample = 0; sample < 3; sample++) {
        const a = side === 0 ? BAD_LAG : other.id;
        const b = side === 0 ? other.id : BAD_LAG;
        const r = runRound(
          a,
          b,
          (other.id + sample) % 3,
          0x51f15e + other.id * 131 + side * 977 + sample * 7919,
          DUEL_MAP,
        );
        out.games++;
        out.seconds += r.seconds;
        out.dmgFor += side === 0 ? r.dmg0 : r.dmg1;
        out.dmgAgainst += side === 0 ? r.dmg1 : r.dmg0;
        if ((side === 0 && r.winner === 0) || (side === 1 && r.winner === 1)) out.wins++;
      }
    }
  }
  return out;
}

function runGauntlet(arena: ArenaDef, seed: number): { wave: number; seconds: number; kills: number } {
  const w = new World('gauntlet', ['PILOT'], 0, arena, false, BAD_LAG);
  const brain = new BotBrain(0, TIER, seed % 3, seed);
  const input = frame();
  let t = 0;
  while (t < CAP && !w.gauntletOver) {
    const p = w.players[0];
    if (p.active && p.alive) brain.think(w, input, SIM_DT);
    else {
      input.mx = 0;
      input.my = 0;
      input.held = 0;
      input.pressed = 0;
    }
    w.step(SIM_DT, [input]);
    w.clearEvents();
    t += SIM_DT;
  }
  return { wave: w.wave, seconds: t, kills: w.gauntletKills };
}

interface Variant {
  name: string;
  tune: Partial<typeof BUFFER>;
  bugCd?: number;
}

const variants: Variant[] = [
  { name: 'live', tune: {} },
  {
    name: 'hourglass',
    tune: { shotSpeed: 640, shotTtl: 1.85, attackCooldown: 0.48, shotCost: 10 },
  },
  {
    name: 'time windows',
    tune: {
      fastTime: 3.2,
      fastScale: 2.7,
      slowTime: 5.6,
      slowScale: 0.26,
      slowChargeTime: 0.5,
      slowCooldown: 8,
    },
    bugCd: 8.5,
  },
  {
    name: 'combo A',
    tune: {
      shotSpeed: 640,
      shotTtl: 1.85,
      attackCooldown: 0.48,
      shotCost: 10,
      fastTime: 3.2,
      fastScale: 2.7,
      slowTime: 5.6,
      slowScale: 0.26,
      slowChargeTime: 0.5,
      slowCooldown: 8,
    },
    bugCd: 8.5,
  },
  {
    name: 'combo B',
    tune: {
      shotSpeed: 680,
      shotTtl: 2.0,
      attackCooldown: 0.44,
      shotCost: 9,
      shotHits: 5,
      fastTime: 3.4,
      fastScale: 2.8,
      slowTime: 6,
      slowScale: 0.24,
      slowChargeTime: 0.45,
      slowCooldown: 7.5,
    },
    bugCd: 8,
  },
  {
    name: 'combo C',
    tune: {
      shotSpeed: 700,
      shotTtl: 2.1,
      attackCooldown: 0.42,
      shotCost: 9,
      shotHits: 5,
      fastTime: 3.6,
      fastScale: 3.0,
      slowTime: 6.5,
      slowScale: 0.22,
      slowChargeTime: 0.4,
      slowCooldown: 6.5,
    },
    bugCd: 6.5,
  },
  {
    name: 'combo D',
    tune: {
      shotSpeed: 700,
      shotTtl: 2.1,
      attackCooldown: 0.45,
      shotCost: 9,
      shotDamage: 1.5,
      shotHits: 5,
      fastTime: 3.4,
      fastScale: 2.8,
      slowTime: 6,
      slowScale: 0.24,
      slowChargeTime: 0.45,
      slowCooldown: 7.5,
    },
    bugCd: 8,
  },
  {
    name: 'combo E',
    tune: {
      shotSpeed: 700,
      shotTtl: 2.1,
      attackCooldown: 0.42,
      shotCost: 9,
      shotDamage: 1.5,
      shotHits: 5,
      fastTime: 3.6,
      fastScale: 3.0,
      slowTime: 6.5,
      slowScale: 0.22,
      slowChargeTime: 0.4,
      slowCooldown: 6.5,
    },
    bugCd: 6.5,
  },
  {
    name: 'combo F',
    tune: {
      shotSpeed: 700,
      shotTtl: 2.1,
      attackCooldown: 0.42,
      shotCost: 9,
      shotDamage: 1.5,
      shotHits: 5,
      fastTime: 3.6,
      fastScale: 2.8,
      slowTime: 6.5,
      slowScale: 0.24,
      slowChargeTime: 0.42,
      slowCooldown: 7,
    },
    bugCd: 7,
  },
  {
    name: 'combo G',
    tune: {
      shotSpeed: 700,
      shotTtl: 2.1,
      attackCooldown: 0.45,
      shotCost: 9,
      shotDamage: 1.5,
      shotHits: 5,
      fastTime: 3.4,
      fastScale: 2.8,
      slowTime: 6.2,
      slowScale: 0.25,
      slowChargeTime: 0.45,
      slowCooldown: 7.25,
    },
    bugCd: 7.5,
  },
];

const base = { ...BUFFER };
const baseBug = [...BUG.cooldown];
console.log(`\nBAD LAG TUNING — ${TIER.toUpperCase()} bots, HP ${BAD_LAG_HP}, cap ${CAP}s\n`);
console.log('VARIANT       DUEL W%  AVG s  DMG FOR  TAKEN   GAUNTLET WAVE  AVG s  KILLS');
for (const v of variants) {
  Object.assign(BUFFER, base, v.tune);
  BUG.cooldown[9] = v.bugCd ?? baseBug[9];
  const d = duels();
  const byMap = { wave: 0, seconds: 0, kills: 0, n: 0 };
  for (let m = 0; m < GAUNTLET_MAPS.length; m++) {
    for (let seed = 0; seed < 2; seed++) {
      const r = runGauntlet(GAUNTLET_MAPS[m], 0x51f15e + m * 977 + seed * 7919);
      byMap.wave += r.wave;
      byMap.seconds += r.seconds;
      byMap.kills += r.kills;
      byMap.n++;
    }
  }
  console.log(
    `${v.name.padEnd(12)} ${(100 * d.wins / d.games).toFixed(1).padStart(7)}  ${(d.seconds / d.games)
      .toFixed(1)
      .padStart(5)}  ${(d.dmgFor / d.games).toFixed(2).padStart(7)}  ${(d.dmgAgainst / d.games)
      .toFixed(2)
      .padStart(5)}   ${(byMap.wave / byMap.n).toFixed(1).padStart(13)}  ${(byMap.seconds / byMap.n)
      .toFixed(1)
      .padStart(5)}  ${(byMap.kills / byMap.n).toFixed(1).padStart(5)}`,
  );
}
Object.assign(BUFFER, base);
BUG.cooldown[9] = baseBug[9];
