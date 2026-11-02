/**
 * Headless INFECTION balance probe. Not shipped.
 *
 * Run:
 *   npx tsx .tmp/infection-balance.ts
 *   INFECTION_MAP=0,1,2 INFECTION_SEEDS=3 npx tsx .tmp/infection-balance.ts
 *
 * Defaults to CROSSROADS, three styles and three seeds per program. Each run is
 * bot-piloted. `localSlot -1` makes slot 0 AI-owned so its bolts use the same 0.8x
 * projectile speed the brain's lead calculation assumes; set INFECTION_LOCAL=1 to
 * mirror the `?infection=1&bot=1` browser hook, where slot 0 owns full-speed shots.
 *
 * Reports clear rate, survival/clear time, end progress and kit usage. It is a
 * measurement harness, not a test and not part of the build.
 */
import { writeFileSync } from 'node:fs';
import { ARENAS, type ArenaDef } from '../src/game/arenas';
import { BotBrain, type BotTier } from '../src/game/bot';
import { BUG, SIM_DT } from '../src/game/config';
import { PROGRAMS } from '../src/game/programs';
import { ACTION, EV, type InputFrame } from '../src/game/types';
import { World } from '../src/game/world';

const TIER: BotTier = 'digital';
const CAP = Number(process.env.INFECTION_CAP ?? 180);
const LOCAL = process.env.INFECTION_LOCAL === '1';
const SKILLS = process.env.INFECTION_SKILLS === '1';
const STYLES = Math.max(1, Math.min(3, Number(process.env.INFECTION_STYLES ?? 3)));
const SEEDS = Math.max(1, Number(process.env.INFECTION_SEEDS ?? 3));
const MAP_FILTER = process.env.INFECTION_MAP ?? '0';
const JSON_PATH = process.env.INFECTION_JSON ?? '';

function selectedArenas(): readonly ArenaDef[] {
  if (MAP_FILTER === 'all') return ARENAS;
  const ids = MAP_FILTER.split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id));
  const out = ARENAS.filter((a) => ids.includes(a.id));
  return out.length > 0 ? out : [ARENAS[0]];
}

function frame(): InputFrame {
  return { mx: 0, my: 0, held: 0, pressed: 0 };
}

interface RunResult {
  program: number;
  programName: string;
  arenaId: number;
  arenaName: string;
  style: number;
  seed: number;
  cleared: boolean;
  failed: boolean;
  seconds: number;
  progress: number;
  kills: number;
  hp: number;
  maxHp: number;
  damageTaken: number;
  shots: number;
  swings: number;
  skills: number;
  heavies: number;
  dashes: number;
  deflects: number;
  guardSeconds: number;
  hitEvents: number;
  damageEvents: number;
  liveViruses: number;
}

function runOne(program: number, style: number, seed: number, arena: ArenaDef): RunResult {
  // A solo infection body is index 0. With localSlot -1 the body is AI-owned, which
  // keeps the brain's lead and the projectile's 0.8x AI speed in agreement.
  const w = new World('gauntlet', ['PILOT'], LOCAL ? 0 : -1, arena, false, program, 0, null, false, null, true);
  // The browser run sets this; keep it here so enemy crossfire does not clear bodies
  // for the pilot and inflate a program's infection time.
  w.friendlyFire = false;
  const brain = new BotBrain(0, TIER, style, seed);
  const input = frame();
  const p = w.players[0];
  let t = 0;
  let lastHp = p.hp;
  let damageTaken = 0;
  let shots = 0;
  let swings = 0;
  let skills = 0;
  let heavies = 0;
  let dashes = 0;
  let deflects = 0;
  let guardFrames = 0;
  let hitEvents = 0;
  let damageEvents = 0;
  let skillTapT = 0;

  while (t < CAP && !w.infectionOver) {
    if (p.active && p.alive) {
      brain.think(w, input, SIM_DT);
      if ((input.held & ACTION.SWING) !== 0) guardFrames++;
      // The gauntlet pilot does not use most Y skills. This opt-in tap is a test
      // fixture, not a bot change: it presses skill whenever it is ready and a
      // virus is within engagement distance, never holding into a heavy.
      skillTapT = Math.max(0, skillTapT - SIM_DT);
      if (SKILLS && skillTapT === 0 && p.bugCd <= 0 && p.energy >= BUG.cost && p.swingPhase === 0 && p.dashT <= 0) {
        let nearest = Infinity;
        for (let i = 0; i < w.viruses.length; i++) {
          const v = w.viruses[i];
          if (!v.active) continue;
          const dx = v.x - p.x;
          const dy = v.y - p.y;
          nearest = Math.min(nearest, dx * dx + dy * dy);
        }
        if (nearest < 440 * 440 && (input.held & ACTION.CANDLE) === 0 && (input.pressed & ACTION.CANDLE) === 0) {
          input.pressed |= ACTION.CANDLE;
          skillTapT = 1.2;
        }
      }
    } else {
      input.mx = 0;
      input.my = 0;
      input.held = 0;
      input.pressed = 0;
    }
    w.step(SIM_DT, [input]);

    for (let i = 0; i < w.eventCount; i++) {
      const e = w.events[i];
      if (e.slot !== 0) continue;
      switch (e.kind) {
        case EV.SHOOT:
          shots++;
          break;
        case EV.SWING:
          swings++;
          break;
        case EV.BUG:
          // Probe's mine trigger is not a skill cast.
          if (e.power !== 4) skills++;
          break;
        case EV.LASER:
          heavies++;
          break;
        case EV.DASH:
          dashes++;
          break;
        case EV.DEFLECT:
          deflects++;
          break;
        case EV.HIT:
          hitEvents++;
          damageEvents += e.power;
          break;
      }
    }
    w.clearEvents();

    if (p.hp < lastHp) damageTaken += lastHp - p.hp;
    lastHp = p.hp;
    t += SIM_DT;
  }

  let live = 0;
  for (let i = 0; i < w.viruses.length; i++) if (w.viruses[i].active) live++;

  return {
    program,
    programName: PROGRAMS[program].name.replace('.EXE', ''),
    arenaId: arena.id,
    arenaName: arena.name,
    style,
    seed,
    cleared: w.infectionCleared,
    failed: w.infectionFailed,
    seconds: w.gauntletTime,
    progress: w.infectionProgress,
    kills: w.infectionKills,
    hp: p.hp,
    maxHp: p.maxHp,
    damageTaken,
    shots,
    swings,
    skills,
    heavies,
    dashes,
    deflects,
    guardSeconds: guardFrames / 60,
    hitEvents,
    damageEvents,
    liveViruses: live,
  };
}

interface Aggregate {
  runs: number;
  clears: number;
  seconds: number;
  clearSeconds: number;
  progress: number;
  kills: number;
  damageTaken: number;
  shots: number;
  swings: number;
  skills: number;
  heavies: number;
  dashes: number;
  deflects: number;
  guardSeconds: number;
  hitEvents: number;
  damageEvents: number;
  endingHp: number;
}

function emptyAggregate(): Aggregate {
  return {
    runs: 0,
    clears: 0,
    seconds: 0,
    clearSeconds: 0,
    progress: 0,
    kills: 0,
    damageTaken: 0,
    shots: 0,
    swings: 0,
    skills: 0,
    heavies: 0,
    dashes: 0,
    deflects: 0,
    guardSeconds: 0,
    hitEvents: 0,
    damageEvents: 0,
    endingHp: 0,
  };
}

function add(a: Aggregate, r: RunResult): void {
  a.runs++;
  if (r.cleared) {
    a.clears++;
    a.clearSeconds += r.seconds;
  }
  a.seconds += r.seconds;
  a.progress += r.progress;
  a.kills += r.kills;
  a.damageTaken += r.damageTaken;
  a.shots += r.shots;
  a.swings += r.swings;
  a.skills += r.skills;
  a.heavies += r.heavies;
  a.dashes += r.dashes;
  a.deflects += r.deflects;
  a.guardSeconds += r.guardSeconds;
  a.hitEvents += r.hitEvents;
  a.damageEvents += r.damageEvents;
  a.endingHp += r.hp;
}

function fmt(n: number, digits = 1): string {
  return n.toFixed(digits);
}

function main(): void {
  const arenas = selectedArenas();
  const results: RunResult[] = [];
  const perProgram = PROGRAMS.map(() => emptyAggregate());
  const perMap = new Map<number, Aggregate>();
  const perStyle = PROGRAMS.map(() => [emptyAggregate(), emptyAggregate(), emptyAggregate()]);
  const started = Date.now();

  for (const arena of arenas) {
    perMap.set(arena.id, emptyAggregate());
    for (const program of PROGRAMS) {
      for (let style = 0; style < STYLES; style++) {
        for (let sample = 0; sample < SEEDS; sample++) {
          const seed = 0x2f6e2b1 + arena.id * 977 + program.id * 131 + style * 7919 + sample * 104729;
          const result = runOne(program.id, style, seed, arena);
          results.push(result);
          add(perProgram[program.id], result);
          add(perMap.get(arena.id)!, result);
          add(perStyle[program.id][style], result);
        }
      }
    }
  }

  const rows = PROGRAMS.map((program) => {
    const a = perProgram[program.id];
    const n = Math.max(1, a.runs);
    return {
      name: program.name.replace('.EXE', ''),
      runs: a.runs,
      clearPct: (100 * a.clears) / n,
      avgSec: a.seconds / n,
      clearSec: a.clears > 0 ? a.clearSeconds / a.clears : NaN,
      progress: 100 * (a.progress / n),
      kills: a.kills / n,
      damage: a.damageTaken / n,
      hp: a.endingHp / n,
      shots: a.shots / n,
      swings: a.swings / n,
      skills: a.skills / n,
      heavies: a.heavies / n,
      dashes: a.dashes / n,
      deflects: a.deflects / n,
      guard: a.guardSeconds / n,
      hitEvents: a.hitEvents / n,
      damageEvents: a.damageEvents / n,
    };
  });

  rows.sort((a, b) => b.clearPct - a.clearPct || b.progress - a.progress || b.avgSec - a.avgSec);

  console.log(
    `\nINFECTION — ${TIER.toUpperCase()} pilot, ${arenas.map((a) => a.name).join(' / ')}, ` +
      `${STYLES} styles x ${SEEDS} seeds x ${PROGRAMS.length} programs, cap ${CAP}s` +
      `${SKILLS ? ', skill taps ON' : ''}\n`,
  );
  console.log('PROGRAM         RUN  CLEAR%  AVG s  CLEAR s  END%  KILL  TAKEN  HP  SHOT  LASH  SKILL  HEAVY  DASH  DEFL  GUARD s');
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(14)} ${String(r.runs).padStart(4)} ${fmt(r.clearPct).padStart(7)} ${fmt(r.avgSec).padStart(6)} ` +
        `${(Number.isNaN(r.clearSec) ? '-' : fmt(r.clearSec)).padStart(7)} ${fmt(r.progress).padStart(5)} ` +
        `${fmt(r.kills).padStart(4)} ${fmt(r.damage).padStart(6)} ${fmt(r.hp).padStart(3)} ` +
        `${fmt(r.shots).padStart(5)} ${fmt(r.swings).padStart(5)} ${fmt(r.skills).padStart(6)} ` +
        `${fmt(r.heavies).padStart(6)} ${fmt(r.dashes).padStart(5)} ${fmt(r.deflects).padStart(5)} ` +
        `${fmt(r.guard).padStart(7)}`,
    );
  }

  console.log('\nBY MAP');
  for (const arena of arenas) {
    const a = perMap.get(arena.id)!;
    const n = Math.max(1, a.runs);
    console.log(
      `${arena.name.padEnd(14)} clear ${fmt((100 * a.clears) / n).padStart(5)}%  avg ${fmt(
        a.seconds / n,
      ).padStart(5)}s  end ${fmt(100 * (a.progress / n)).padStart(5)}%  kills ${fmt(a.kills / n).padStart(4)}`,
    );
  }

  console.log('\nBY STYLE');
  console.log('PROGRAM         DUELIST         TRICKSTER        SIEGE');
  for (const program of PROGRAMS) {
    const cells = perStyle[program.id].map((a, style) => {
      if (style >= STYLES) return '   -   ';
      const n = Math.max(1, a.runs);
      return `${fmt((100 * a.clears) / n, 0)}%/${fmt(a.seconds / n, 0)}s`.padStart(8);
    });
    console.log(`${program.name.replace('.EXE', '').padEnd(14)} ${cells.join('        ')}`);
  }

  const total = results.length;
  const clears = results.filter((r) => r.cleared).length;
  const deaths = results.filter((r) => r.failed).length;
  const timeouts = results.filter((r) => !r.cleared && !r.failed).length;
  console.log(
    `\nOVERALL ${clears}/${total} clears (${fmt((100 * clears) / total)}%), ${deaths} deaths, ${timeouts} timeouts, ` +
      `${fmt(results.reduce((s, r) => s + r.seconds, 0) / total)}s average`,
  );
  console.log(`WALL ${(((Date.now() - started) / 1000) | 0)}s\n`);

  if (JSON_PATH) {
    writeFileSync(
      JSON_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          tier: TIER,
          cap: CAP,
          localSlot: LOCAL ? 0 : -1,
          styles: STYLES,
          seeds: SEEDS,
          arenas: arenas.map((a) => ({ id: a.id, name: a.name })),
          totals: { runs: total, clears, deaths, timeouts },
          rows,
          results,
        },
        null,
        2,
      ),
    );
    console.log(`JSON ${JSON_PATH}`);
  }
}

main();
