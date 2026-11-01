/**
 * Headless balance probe: bot-vs-bot program duels and bot-piloted gauntlet runs.
 * Run with `npx tsx .tmp/balance.ts duels` or `... gauntlet`.
 * Not shipped; a measurement harness for tuning, not a test.
 */
import { ARENAS, type ArenaDef } from '../src/game/arenas';
import { BotBrain, type BotTier } from '../src/game/bot';
import { AIMBOT, BUFFER, SIM_DT } from '../src/game/config';
import { PROGRAM_ID, PROGRAMS } from '../src/game/programs';
import { World } from '../src/game/world';
import type { InputFrame } from '../src/game/types';

const TIER: BotTier = 'digital';
const ROUND_CAP = 50;
const GAUNTLET_CAP = Number(process.env.BALANCE_CAP ?? 200);
const MODE = process.argv[2] ?? 'all';
const MAP_FILTER = process.argv[3] ?? process.env.BALANCE_MAP ?? 'all';

function selectedArenas(): readonly ArenaDef[] {
  if (MAP_FILTER === 'all') return ARENAS;
  const id = Number(MAP_FILTER);
  if (Number.isInteger(id)) {
    const byId = ARENAS.filter((arena) => arena.id === id);
    if (byId.length > 0) return byId;
  }
  const q = MAP_FILTER.toLowerCase();
  const matches = ARENAS.filter((arena) => arena.name.toLowerCase().includes(q));
  return matches.length > 0 ? matches : ARENAS;
}

function hazardLabel(arena: ArenaDef): string {
  const tags: string[] = [];
  if (arena.emitters?.length) tags.push('EMITTERS');
  if (arena.pushers) tags.push('COMPACTOR');
  if (arena.disc) tags.push('DISC');
  if (arena.voids?.length) tags.push('VOID');
  if (arena.walls === 'open') tags.push('OPEN');
  if (arena.pipes?.length) tags.push('PIPES');
  if (arena.bumpers?.length) tags.push('BUMPERS');
  if (arena.traverse) tags.push('TRAVERSE');
  if (arena.firewallSwitch) tags.push('SWITCH');
  return tags.length > 0 ? tags.join('+') : 'CLEAN';
}

function frame(): InputFrame {
  return { mx: 0, my: 0, held: 0, pressed: 0 };
}

interface RoundResult {
  winner: number;
  seconds: number;
  dmg0: number;
  dmg1: number;
}

function runRound(a: number, b: number, style: number, seed: number, arena: ArenaDef = ARENAS[0]): RoundResult {
  // localSlot -1 + botSlots 1 makes both bodies AI-owned, so their projectiles use the
  // 0.8x enemy speed their lead calculation assumes. With localSlot 0 the slot-0 shots
  // ran at full speed while the brain still led at 0.8x, which biased every duel.
  const w = new World('match', ['A', 'B'], -1, arena, false, a, 1, [a, b]);
  const brains = [new BotBrain(0, TIER, style, seed), new BotBrain(1, TIER, (style + 1) % 3, seed ^ 0x9e37)];
  const inputs = [frame(), frame()];
  let t = 0;
  let dmg0 = 0;
  let dmg1 = 0;
  let last0 = w.players[0].hp;
  let last1 = w.players[1].hp;

  while (t < ROUND_CAP) {
    if (w.phase === 'live') {
      brains[0].think(w, inputs[0], SIM_DT);
      brains[1].think(w, inputs[1], SIM_DT);
    } else {
      inputs[0].pressed = 0;
      inputs[1].pressed = 0;
    }
    w.step(SIM_DT, inputs);
    w.clearEvents();
    // Read hp before the phase check: a killing blow lands on the same step that
    // flips the round to `roundover`, so gating this on `live` dropped every finisher.
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

function duels(arena: ArenaDef): void {
  const n = PROGRAMS.length;
  const wins = new Array(n).fill(0);
  const losses = new Array(n).fill(0);
  const draws = new Array(n).fill(0);
  const seconds = new Array(n).fill(0);
  const dmgFor = new Array(n).fill(0);
  const dmgAgainst = new Array(n).fill(0);
  const games = new Array(n).fill(0);
  // Head-to-head counts both slot orders: cell [a][b] is a's wins out of 2 games.
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  const started = Date.now();
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      // Three deterministic samples per ordered pair, rotating bot styles and seeds.
      // One sample per pair moved individual win rates by 15-20 points between runs,
      // which is not a signal worth tuning against.
      for (let sample = 0; sample < 3; sample++) {
        const r = runRound(
          a,
          b,
          (a + b + sample) % 3,
          0x51f15e + a * 131 + b * 17 + sample * 7919,
          arena,
        );
        games[a]++;
        seconds[a] += r.seconds;
        dmgFor[a] += r.dmg0;
        dmgAgainst[a] += r.dmg1;
        if (r.winner === 0) {
          wins[a]++;
          losses[b]++;
          matrix[a][b] += 1;
        } else if (r.winner === 1) {
          wins[b]++;
          losses[a]++;
          matrix[b][a] += 1;
        } else {
          draws[a]++;
          draws[b]++;
          matrix[a][b] += 0.5;
          matrix[b][a] += 0.5;
        }
      }
    }
  }

  const rows = PROGRAMS.map((p, i) => {
    const played = wins[i] + losses[i] + draws[i];
    return {
      name: p.name.replace('.EXE', ''),
      wins: wins[i],
      losses: losses[i],
      draws: draws[i],
      winPct: (100 * (wins[i] + 0.5 * draws[i])) / Math.max(1, played),
      avgSec: seconds[i] / Math.max(1, played),
      dmgFor: dmgFor[i] / Math.max(1, played),
      dmgAgainst: dmgAgainst[i] / Math.max(1, played),
    };
  }).sort((x, y) => y.winPct - x.winPct);

  console.log(
    `\nPROGRAM DUELS — ${TIER.toUpperCase()} bots, one round per ordered pair, ${arena.name} [${hazardLabel(arena)}]\n`,
  );
  console.log('PROGRAM        W   L   D   WIN%   AVG s   DMG FOR   TAKEN');
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(14)} ${String(r.wins).padStart(2)}  ${String(r.losses).padStart(2)}  ${String(
        r.draws,
      ).padStart(2)}  ${r.winPct.toFixed(1).padStart(5)}  ${r.avgSec.toFixed(1).padStart(6)}  ${r.dmgFor
        .toFixed(2)
        .padStart(7)}  ${r.dmgAgainst.toFixed(2).padStart(6)}`,
    );
  }

  console.log('\nHEAD-TO-HEAD (row wins vs column, 1/0/.5)\n');
  const short = PROGRAMS.map((p) => p.name.replace('.EXE', '').slice(0, 4).padEnd(5));
  console.log(`        ${short.join('')}`);
  for (let a = 0; a < n; a++) {
    const cells = PROGRAMS.map((_, b) => (a === b ? ' --  ' : ` ${matrix[a][b].toFixed(1)} `));
    console.log(`${short[a]} ${cells.join('')}`);
  }
  console.log(`\n${(((Date.now() - started) / 1000) | 0)}s wall\n`);
}

interface GauntletResult {
  seconds: number;
  wave: number;
  kills: number;
  deaths: number;
}

function runGauntlet(program: number, practice: boolean, seed: number, arena: ArenaDef): GauntletResult {
  const w = new World('gauntlet', ['PILOT'], 0, arena, practice, program);
  const brain = new BotBrain(0, TIER, seed % 3, seed);
  const input = frame();
  let t = 0;
  let deaths = 0;
  let lastHp = w.players[0].hp;
  while (t < GAUNTLET_CAP) {
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
    const now = w.players[0];
    if (!now.alive && lastHp > 0) deaths++;
    lastHp = now.hp;
    t += SIM_DT;
    if (w.gauntletOver) break;
  }
  return { seconds: t, wave: w.wave, kills: w.gauntletKills, deaths };
}

function gauntlet(arena: ArenaDef): void {
  console.log(
    `\nGAUNTLET — ${TIER.toUpperCase()} pilot, scored run, ${arena.name} [${hazardLabel(arena)}], cap ${GAUNTLET_CAP}s\n`,
  );
  console.log('PROGRAM         WAVE   SECONDS   KILLS   DEATHS');
  const started = Date.now();
  const rows: { name: string; wave: number; seconds: number; kills: number; deaths: number }[] = [];
  for (const p of PROGRAMS) {
    const r = runGauntlet(p.id, false, 0x51f15e + p.id * 977, arena);
    rows.push({ name: p.name.replace('.EXE', ''), ...r });
  }
  rows.sort((a, b) => b.wave - a.wave || b.seconds - a.seconds);
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(14)}  ${String(r.wave).padStart(3)}  ${r.seconds.toFixed(1).padStart(8)}  ${String(
        r.kills,
      ).padStart(5)}  ${String(r.deaths).padStart(6)}`,
    );
  }
  const avg = (read: (r: (typeof rows)[number]) => number): string =>
    (rows.reduce((sum, r) => sum + read(r), 0) / Math.max(1, rows.length)).toFixed(1);
  console.log(`\nMAP AVG  wave ${avg((r) => r.wave)}   seconds ${avg((r) => r.seconds)}   kills ${avg((r) => r.kills)}`);
  console.log(`\n${(((Date.now() - started) / 1000) | 0)}s wall\n`);
}

function sweep(arena: ArenaDef): void {
  const target = PROGRAMS[PROGRAMS.length - 1].id;
  const variants = [
    { name: 'live 3200/20', damage: 8, cooldown: 1.65, speed: 3200, ttl: 20 },
    { name: '2400/1.6', damage: 8, cooldown: 1.65, speed: 2400, ttl: 1.6 },
    { name: '2000/1.6', damage: 8, cooldown: 1.65, speed: 2000, ttl: 1.6 },
    { name: '1800/1.6', damage: 8, cooldown: 1.65, speed: 1800, ttl: 1.6 },
    { name: '1800/1.6 cd2', damage: 8, cooldown: 2.0, speed: 1800, ttl: 1.6 },
    { name: '3200 ttl1.6', damage: 8, cooldown: 1.65, speed: 3200, ttl: 1.6 },
  ];
  console.log(`\nRAIL SWEEP — AIM_BOT vs the roster, both sides, 2 seeds, ${TIER.toUpperCase()} bots, ${arena.name}\n`);
  console.log('VARIANT          WIN%   AVG s   DMG FOR   TAKEN');
  for (const v of variants) {
    AIMBOT.shotDamage = v.damage;
    AIMBOT.attackCooldown = v.cooldown;
    AIMBOT.shotSpeed = v.speed;
    AIMBOT.shotTtl = v.ttl;
    let wins = 0;
    let games = 0;
    let sec = 0;
    let dmgFor = 0;
    let dmgAgainst = 0;
    for (const other of PROGRAMS) {
      if (other.id === target) continue;
      for (let side = 0; side < 2; side++) {
        for (let seed = 0; seed < 2; seed++) {
          const a = side === 0 ? target : other.id;
          const b = side === 0 ? other.id : target;
          const r = runRound(a, b, (other.id + seed) % 3, 0x51f15e + other.id * 131 + side * 977 + seed * 41, arena);
          games++;
          sec += r.seconds;
          const aimWon = side === 0 ? r.winner === 0 : r.winner === 1;
          if (aimWon) wins++;
          dmgFor += side === 0 ? r.dmg0 : r.dmg1;
          dmgAgainst += side === 0 ? r.dmg1 : r.dmg0;
        }
      }
    }
    console.log(
      `${v.name.padEnd(17)} ${((100 * wins) / games).toFixed(1).padStart(5)}  ${(sec / games).toFixed(1).padStart(6)}  ${(
        dmgFor / games
      ).toFixed(2).padStart(7)}  ${(dmgAgainst / games).toFixed(2).padStart(6)}`,
    );
  }
}

interface Threats {
  pulse: number;
  triplex: number;
  homing: number;
  flock: number;
  worm: number;
  virus: number;
  error: number;
  thrall: number;
}

function threats(w: World): Threats {
  const t: Threats = { pulse: 0, triplex: 0, homing: 0, flock: 0, worm: 0, virus: 0, error: 0, thrall: 0 };
  for (const s of w.sentries) {
    if (!s.active) continue;
    if (s.kind === 0) t.pulse++;
    else if (s.kind === 1) t.triplex++;
    else if (s.kind === 2) t.homing++;
    else if (s.kind === 3) t.flock++;
  }
  for (const x of w.worms) if (x.active) t.worm++;
  for (const x of w.viruses) if (x.active) t.virus++;
  for (const x of w.errors) if (x.active) t.error++;
  if (w.players[1]?.active) t.thrall++;
  return t;
}

const FAMILIES = ['pulse', 'triplex', 'homing', 'flock', 'worm', 'virus', 'error', 'thrall'] as const;

function nearestThreat(w: World, x: number, y: number): (typeof FAMILIES)[number] | 'other' {
  let best = 200 * 200;
  let fam: (typeof FAMILIES)[number] | 'other' = 'other';
  const test = (kind: (typeof FAMILIES)[number], px: number, py: number): void => {
    const d2 = (px - x) * (px - x) + (py - y) * (py - y);
    if (d2 < best) {
      best = d2;
      fam = kind;
    }
  };
  for (const s of w.sentries) {
    if (!s.active) continue;
    const kind = s.kind === 0 ? 'pulse' : s.kind === 1 ? 'triplex' : s.kind === 2 ? 'homing' : 'flock';
    test(kind, s.x, s.y);
  }
  for (const x of w.worms) if (x.active) test('worm', x.x, x.y);
  for (const x of w.viruses) if (x.active) test('virus', x.x, x.y);
  for (const x of w.errors) if (x.active) test('error', x.x, x.y);
  const thrall = w.players[1];
  if (thrall?.active) test('thrall', thrall.x, thrall.y);
  return fam;
}

function waves(arena: ArenaDef): void {
  const startWaves = [3, 6, 9, 12, 15, 18, 21, 24];
  const pilots = [0, 6, 12];
  console.log(
    `\nWAVE PRESSURE — ${TIER.toUpperCase()} pilot, 60s window from each wave, ${arena.name} [${hazardLabel(arena)}]\n`,
  );
  console.log('WAVE  PROGRAM      SURV s  KILLS  P/T/H/F  W/V/E   DAMAGE TAKEN BY FAMILY');
  const started = Date.now();
  for (const start of startWaves) {
    for (const program of pilots) {
      const w = new World('gauntlet', ['PILOT'], 0, arena, false, program);
      w.gauntletT = (start - 1) * 30;
      w.wave = start;
      const brain = new BotBrain(0, TIER, start % 3, 0x51f15e + start * 977 + program * 131);
      const input = frame();
      const sum: Threats = { pulse: 0, triplex: 0, homing: 0, flock: 0, worm: 0, virus: 0, error: 0, thrall: 0 };
      const dmg = new Map<string, number>();
      let samples = 0;
      let t = 0;
      let lastHp = w.players[0].hp;
      while (t < 60 && !w.gauntletOver) {
        brain.think(w, input, SIM_DT);
        w.step(SIM_DT, [input]);
        w.clearEvents();
        const p = w.players[0];
        if (p.hp < lastHp - 1e-6) {
          const fam = nearestThreat(w, p.x, p.y);
          dmg.set(fam, (dmg.get(fam) ?? 0) + (lastHp - p.hp));
        }
        lastHp = p.hp;
        if (t % 0.5 < SIM_DT) {
          const c = threats(w);
          for (const k of FAMILIES) sum[k] += c[k];
          samples++;
        }
        t += SIM_DT;
      }
      const per = (k: keyof Threats): string => (sum[k] / Math.max(1, samples)).toFixed(1);
      const dmgText =
        [...dmg.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${k} ${v.toFixed(1)}`)
          .join('  ') || '-';
      console.log(
        `${String(start).padStart(4)}  ${PROGRAMS[program].name.replace('.EXE', '').padEnd(11)}  ${t
          .toFixed(1)
          .padStart(6)}  ${String(w.gauntletKills).padStart(5)}  ${per('pulse')}/${per('triplex')}/${per('homing')}/${per(
          'flock',
        )}  ${per('worm')}/${per('virus')}/${per('error')}  ${dmgText}`,
      );
    }
  }
  console.log(`\n${(((Date.now() - started) / 1000) | 0)}s wall\n`);
}

function bufferSweep(): void {
  const base = { ...BUFFER };
  const maps = [ARENAS[1], ARENAS[7], ARENAS[9]];
  const variants: { name: string; tune: Partial<typeof BUFFER> }[] = [
    { name: 'live', tune: {} },
    { name: 'speed 680', tune: { shotSpeed: 680 } },
    { name: 'ttl 2.1', tune: { shotTtl: 2.1 } },
    { name: 'dmg 1.25', tune: { shotDamage: 1.25 } },
    { name: 'dmg 1.5', tune: { shotDamage: 1.5 } },
    { name: 'hits 5', tune: { shotHits: 5 } },
    { name: 'fast 3.2', tune: { fastTime: 3.2 } },
    { name: 'slow 6s', tune: { slowTime: 6 } },
    { name: 'combo A', tune: { shotSpeed: 680, shotTtl: 2.0, shotHits: 5, fastTime: 3.2 } },
    {
      name: 'combo B',
      tune: { shotSpeed: 680, shotTtl: 2.1, shotDamage: 1.25, shotHits: 5, fastTime: 3.2, slowTime: 6 },
    },
  ];
  console.log(
    `\nBAD_LAG SWEEP — ${TIER.toUpperCase()} pilot, ${maps.map((a) => a.name).join(' / ')}, cap ${GAUNTLET_CAP}s\n`,
  );
  console.log('VARIANT     AVG WAVE  AVG s  KILLS   GRID W / BIN W / NET W');
  for (const v of variants) {
    Object.assign(BUFFER, base, v.tune);
    const byMap = maps.map(() => ({ wave: 0, seconds: 0, kills: 0, n: 0 }));
    for (let m = 0; m < maps.length; m++) {
      for (let seed = 0; seed < 2; seed++) {
        const r = runGauntlet(PROGRAM_ID.BUFFER, false, 0x51f15e + m * 977 + seed * 7919, maps[m]);
        const row = byMap[m];
        row.wave += r.wave;
        row.seconds += r.seconds;
        row.kills += r.kills;
        row.n++;
      }
    }
    const wave = byMap.reduce((s, r) => s + r.wave / r.n, 0) / maps.length;
    const seconds = byMap.reduce((s, r) => s + r.seconds / r.n, 0) / maps.length;
    const kills = byMap.reduce((s, r) => s + r.kills / r.n, 0) / maps.length;
    console.log(
      `${v.name.padEnd(11)} ${wave.toFixed(1).padStart(8)}  ${seconds.toFixed(1).padStart(5)}  ${kills
        .toFixed(1)
        .padStart(5)}   ${byMap.map((r) => (r.wave / r.n).toFixed(1)).join(' / ')}`,
    );
  }
  Object.assign(BUFFER, base);
  console.log('');
}

const arenas = selectedArenas();
if (MODE === 'duels' || MODE === 'all') for (const arena of arenas) duels(arena);
if (MODE === 'sweep') for (const arena of arenas) sweep(arena);
if (MODE === 'waves') for (const arena of arenas) waves(arena);
if (MODE === 'buffer') bufferSweep();
if (MODE === 'gauntlet' || MODE === 'all') for (const arena of arenas) gauntlet(arena);
