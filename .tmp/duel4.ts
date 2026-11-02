/**
 * Headless 4-player FFA balance probe.
 * Run with `npx tsx .tmp/duel4.ts`.
 *
 * Every round seats four distinct programs. Programs are scheduled in balanced
 * blocks, so each program appears the same number of times and in rotating seats.
 * The harness counts real world events, not inferred intent:
 *   EV.SHOOT    ranged attacks
 *   EV.SWING    melee lashes (guard holds do not emit this)
 *   EV.BUG      skills (trap triggers are excluded)
 *   EV.LASER    heavies (no powerups in a match, so no overcharge beam)
 *   EV.DEFLECT  total catches; World.deflectTelemetry splits them by source
 *
 * All four bodies are AI-owned (localSlot -1, botSlots 3) so bot bolts use the
 * same 0.8x enemy speed their lead calculation expects.
 */
import {
  AIMBOT,
  ATOMIZE,
  BUFFER,
  COMPRESS,
  COPYPASTA,
  FISHER,
  GHOST,
  KABOOM,
  MINE,
  PINBALL,
  ROUND,
  SIM_DT,
  SWEEP,
  TOXIC,
  WEDGE,
} from '../src/game/config';
import { ARENAS, type ArenaDef } from '../src/game/arenas';
import { BotBrain, type BotTier } from '../src/game/bot';
import { PROGRAMS } from '../src/game/programs';
import { ACTION, EV, type InputFrame } from '../src/game/types';
import { World } from '../src/game/world';

const TIER: BotTier = 'digital';
const ROUND_CAP = Number(process.env.DUEL4_CAP ?? 45);
const ROUNDS = Math.max(13, Number(process.env.DUEL4_ROUNDS ?? 260));
const SEED = Number(process.env.DUEL4_SEED ?? 0x4d2f1a);
const MAP_FILTER = process.env.DUEL4_MAP ?? '0';

function selectedArena(): ArenaDef {
  const id = Number(MAP_FILTER);
  if (Number.isInteger(id)) {
    const arena = ARENAS.find((a) => a.id === id);
    if (arena) return arena;
  }
  const q = MAP_FILTER.toLowerCase();
  return ARENAS.find((a) => a.name.toLowerCase().includes(q)) ?? ARENAS[0];
}

/** Optional local sweep overrides, e.g. DUEL4_OVERRIDES='{"AIMBOT":{"shotDamage":6}}'. */
const KITS: Record<string, Record<string, number>> = {
  WEDGE,
  FISHER,
  SWEEP,
  TOXIC,
  KABOOM,
  MINE,
  BUFFER,
  ATOMIZE,
  GHOST,
  COMPRESS,
  PINBALL,
  COPYPASTA,
  AIMBOT,
};
if (process.env.DUEL4_OVERRIDES) {
  const overrides = JSON.parse(process.env.DUEL4_OVERRIDES) as Record<string, Record<string, number>>;
  for (const [kit, patch] of Object.entries(overrides)) {
    const target = KITS[kit];
    if (!target) throw new Error(`Unknown kit in DUEL4_OVERRIDES: ${kit}`);
    Object.assign(target, patch);
  }
}

function frame(): InputFrame {
  return { mx: 0, my: 0, held: 0, pressed: 0 };
}

interface SeatStats {
  shots: number;
  swings: number;
  skills: number;
  heavies: number;
  shieldCatches: number;
  kitDeflects: number;
  atomBlocks: number;
  deflects: number;
  guardFrames: number;
  heavyAttempts: number;
  hits: number;
  damage: number;
  damageTaken: number;
  kills: number;
}

function seatStats(): SeatStats {
  return {
    shots: 0,
    swings: 0,
    skills: 0,
    heavies: 0,
    shieldCatches: 0,
    kitDeflects: 0,
    atomBlocks: 0,
    deflects: 0,
    guardFrames: 0,
    heavyAttempts: 0,
    hits: 0,
    damage: 0,
    damageTaken: 0,
    kills: 0,
  };
}

interface RoundResult {
  winner: number;
  timeout: boolean;
  seconds: number;
  placements: number[];
  stats: SeatStats[];
  deaths: number;
  eventDeflects: number;
}

function runRound(programs: readonly number[], styles: readonly number[], seed: number, arena: ArenaDef): RoundResult {
  const names = ['A', 'B', 'C', 'D'];
  const w = new World('match', names, -1, arena, false, programs[0], 3, programs);
  const brains = programs.map((_, slot) => new BotBrain(slot, TIER, styles[slot], seed + slot * 0x9e37));
  const inputs = programs.map(() => frame());
  const stats = programs.map(() => seatStats());
  const lastHp = w.players.slice(0, 4).map((p) => p.hp);
  const wasAlive = w.players.slice(0, 4).map((p) => p.alive);
  const deathOrder: number[] = [];
  let t = 0;
  let eventDeflects = 0;

  while (t < ROUND_CAP) {
    if (w.phase === 'live') {
      for (let i = 0; i < 4; i++) {
        brains[i].think(w, inputs[i], SIM_DT);
        // Guard is the only action that holds SWING; a lash is a press.
        if ((inputs[i].held & ACTION.SWING) !== 0) stats[i].guardFrames++;
      }
    } else {
      for (let i = 0; i < 4; i++) {
        inputs[i].mx = 0;
        inputs[i].my = 0;
        inputs[i].held = 0;
        inputs[i].pressed = 0;
      }
    }
    w.step(SIM_DT, inputs);

    for (let i = 0; i < w.eventCount; i++) {
      const e = w.events[i];
      if (e.slot < 0 || e.slot >= 4) continue;
      const s = stats[e.slot];
      switch (e.kind) {
        case EV.SHOOT:
          s.shots++;
          break;
        case EV.SWING:
          s.swings++;
          break;
        case EV.BUG:
          // Probe's armed mine reports a trigger with power 4; that is not a cast.
          if (e.power !== 4) s.skills++;
          break;
        case EV.LASER:
          s.heavies++;
          break;
        case EV.DEFLECT:
          eventDeflects++;
          break;
        case EV.HIT:
          s.hits++;
          s.damage += e.power;
          break;
        case EV.ELIMINATED:
          if (e.power !== e.slot) s.kills++;
          break;
      }
    }
    w.clearEvents();

    for (let i = 0; i < 4; i++) {
      const p = w.players[i];
      if (p.hp < lastHp[i]) stats[i].damageTaken += lastHp[i] - p.hp;
      lastHp[i] = p.hp;
      if (wasAlive[i] && !p.alive) deathOrder.push(i);
      wasAlive[i] = p.alive;
    }

    t += SIM_DT;
    if (w.phase === 'roundover') break;
  }

  // Read the exact source counters once the round is settled. Event kind alone
  // cannot tell a guard catch from a net, arm swat, beam glance or atom block.
  for (let slot = 0; slot < 4; slot++) {
    const tel = w.deflectTelemetry;
    const shield = tel.guard[slot] + tel.swing[slot];
    const kit =
      tel.beam[slot] + tel.net[slot] + tel.arm[slot] + tel.plow[slot] + tel.broom[slot] + tel.wave[slot];
    const atom = tel.atom[slot];
    const s = stats[slot];
    s.shieldCatches = shield;
    s.kitDeflects = kit;
    s.atomBlocks = atom;
    s.deflects = shield + kit + atom;
    s.heavyAttempts = brains[slot].heavyCount;
  }

  const winner = w.roundWinner;
  const placements = [0, 0, 0, 0];
  if (winner >= 0) {
    placements[winner] = 4;
    for (let i = 0; i < deathOrder.length && i < 3; i++) placements[deathOrder[i]] = i + 1;
  }

  return {
    winner,
    timeout: winner < 0,
    seconds: Math.max(0, t - ROUND.countdown),
    placements,
    stats,
    deaths: deathOrder.length,
    eventDeflects,
  };
}

interface Aggregate {
  apps: number;
  wins: number;
  top2: number;
  placement: number;
  seconds: number;
  damage: number;
  taken: number;
  shots: number;
  swings: number;
  skills: number;
  heavies: number;
  shieldCatches: number;
  kitDeflects: number;
  atomBlocks: number;
  deflects: number;
  guardSeconds: number;
  heavyAttempts: number;
  kills: number;
  reflectRounds: number;
  shieldRounds: number;
}

function aggregate(): Aggregate {
  return {
    apps: 0,
    wins: 0,
    top2: 0,
    placement: 0,
    seconds: 0,
    damage: 0,
    taken: 0,
    shots: 0,
    swings: 0,
    skills: 0,
    heavies: 0,
    shieldCatches: 0,
    kitDeflects: 0,
    atomBlocks: 0,
    deflects: 0,
    guardSeconds: 0,
    heavyAttempts: 0,
    kills: 0,
    reflectRounds: 0,
    shieldRounds: 0,
  };
}

/** xorshift32 keeps the schedule deterministic without pulling the game RNG into layout. */
function nextSeed(state: number): number {
  let x = state | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = nextSeed(s);
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function fmt(n: number, digits = 1): string {
  return n.toFixed(digits);
}

function main(): void {
  const arena = selectedArena();
  const roster = PROGRAMS.map((p) => p.id);
  const totals = new Map<number, Aggregate>(roster.map((id) => [id, aggregate()]));
  let decisive = 0;
  let timeouts = 0;
  let totalSeconds = 0;
  let totalDeaths = 0;
  let totalShots = 0;
  let totalSwings = 0;
  let totalSkills = 0;
  let totalHeavies = 0;
  let totalDeflects = 0;
  let totalShieldCatches = 0;
  let totalKitDeflects = 0;
  let totalAtomBlocks = 0;
  let totalReflectRounds = 0;
  let totalShieldRounds = 0;
  let totalDeflectEvents = 0;
  let totalHeavyAttempts = 0;
  let totalGuardSeconds = 0;
  const started = Date.now();

  for (let round = 0; round < ROUNDS; round++) {
    const block = Math.floor(round / roster.length);
    const within = round % roster.length;
    // One permutation per block, read as a sliding four-wide window. Across the
    // 13-round block every program appears exactly four times.
    const perm = shuffled(roster, SEED + block * 0x45d9f3b);
    const programs = [0, 1, 2, 3].map((k) => perm[(within + k) % roster.length]);
    // Rotate seats so a program is not always slot 0 (slot 0 is also the World's
    // selected program, which keeps the construction honest).
    const seats = shuffled(programs, SEED + block * 0x27d4eb2d + within * 0x165667b1);
    const styles = [0, 1, 2, 3].map((k) => (k + block + within) % 3);
    const result = runRound(seats, styles, SEED + block * 131 + within * 7919, arena);

    totalSeconds += result.seconds;
    totalDeaths += result.deaths;
    if (result.timeout) timeouts++;
    else decisive++;

    for (let slot = 0; slot < 4; slot++) {
      const program = seats[slot];
      const s = result.stats[slot];
      const a = totals.get(program);
      if (!a) continue;
      a.apps++;
      a.seconds += result.seconds;
      a.damage += s.damage;
      a.taken += s.damageTaken;
      a.shots += s.shots;
      a.swings += s.swings;
      a.skills += s.skills;
      a.heavies += s.heavies;
      a.shieldCatches += s.shieldCatches;
      a.kitDeflects += s.kitDeflects;
      a.atomBlocks += s.atomBlocks;
      a.deflects += s.deflects;
      a.guardSeconds += s.guardFrames / 60;
      a.heavyAttempts += s.heavyAttempts;
      a.kills += s.kills;
      if (s.deflects > 0) a.reflectRounds++;
      if (s.shieldCatches > 0) a.shieldRounds++;
      if (result.winner === slot) a.wins++;
      const place = result.placements[slot];
      if (place > 0) {
        a.placement += place;
        if (place >= 3) a.top2++;
      }
      totalShots += s.shots;
      totalSwings += s.swings;
      totalSkills += s.skills;
      totalHeavies += s.heavies;
      totalDeflects += s.deflects;
      totalShieldCatches += s.shieldCatches;
      totalKitDeflects += s.kitDeflects;
      totalAtomBlocks += s.atomBlocks;
      totalHeavyAttempts += s.heavyAttempts;
      totalGuardSeconds += s.guardFrames / 60;
      if (s.deflects > 0) totalReflectRounds++;
      if (s.shieldCatches > 0) totalShieldRounds++;
    }
    totalDeflectEvents += result.eventDeflects;
  }

  const rows = PROGRAMS.map((p, id) => {
    const a = totals.get(id) ?? aggregate();
    const apps = Math.max(1, a.apps);
    return {
      name: p.name.replace('.EXE', ''),
      apps: a.apps,
      winPct: (100 * a.wins) / apps,
      top2Pct: (100 * a.top2) / apps,
      place: a.placement / apps,
      sec: a.seconds / apps,
      dmg: a.damage / apps,
      taken: a.taken / apps,
      shots: a.shots / apps,
      swings: a.swings / apps,
      skills: a.skills / apps,
      heavies: a.heavies / apps,
      shieldCatches: a.shieldCatches / apps,
      kitDeflects: a.kitDeflects / apps,
      atomBlocks: a.atomBlocks / apps,
      deflects: a.deflects / apps,
      guardSeconds: a.guardSeconds / apps,
      heavyAttempts: a.heavyAttempts / apps,
      shieldPer100: (100 * a.shieldCatches) / Math.max(1, a.shots),
      reflectRoundsPct: (100 * a.reflectRounds) / apps,
      shieldRoundsPct: (100 * a.shieldRounds) / apps,
      kills: a.kills / apps,
    };
  }).sort((x, y) => y.place - x.place || y.winPct - x.winPct);

  console.log(
    `\n4P FFA — ${TIER.toUpperCase()} bots, ${arena.name}, ${ROUNDS} rounds, ${fmt(
      ROUND_CAP,
      0,
    )}s cap, seed ${SEED.toString(16)}\n`,
  );
  console.log('OUTCOMES');
  console.log('PROGRAM         APP  WIN%  TOP2%  PLACE  AVG s  DMG  TAKEN  KILL');
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(14)} ${String(r.apps).padStart(3)}  ${fmt(r.winPct).padStart(5)}  ${fmt(r.top2Pct).padStart(
        5,
      )}  ${fmt(r.place, 2).padStart(5)}  ${fmt(r.sec).padStart(5)}  ${fmt(r.dmg, 0).padStart(
        3,
      )}  ${fmt(r.taken, 0).padStart(5)}  ${fmt(r.kills).padStart(4)}`,
    );
  }

  console.log('\nACTIONS / DEFENSE (per appearance)');
  console.log(
    'PROGRAM         SHOT  LASH  SKILL  HEAVY  H.ATT  GUARD s  SHIELD  KIT  ATOM  SH/100  REFL%',
  );
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(14)} ${fmt(r.shots).padStart(4)}  ${fmt(r.swings).padStart(4)}  ${fmt(r.skills).padStart(
        5,
      )}  ${fmt(r.heavies).padStart(5)}  ${fmt(r.heavyAttempts).padStart(5)}  ${fmt(r.guardSeconds).padStart(
        6,
      )}  ${fmt(r.shieldCatches).padStart(6)}  ${fmt(r.kitDeflects).padStart(3)}  ${fmt(r.atomBlocks).padStart(
        4,
      )}  ${fmt(r.shieldPer100).padStart(6)}  ${fmt(r.reflectRoundsPct, 0).padStart(4)}`,
    );
  }

  const appearances = Math.max(1, ROUNDS * 4);
  console.log(
    `\nOVERALL  decisive ${decisive}/${ROUNDS} (${fmt((100 * decisive) / ROUNDS, 0)}%), timeouts ${timeouts}, ` +
      `avg live ${fmt(totalSeconds / ROUNDS)}s, deaths/round ${fmt(totalDeaths / ROUNDS)}`,
  );
  console.log(
    `ACTIONS  shots ${fmt(totalShots / appearances)}  lashes ${fmt(totalSwings / appearances)}  ` +
      `skills ${fmt(totalSkills / appearances)}  heavies ${fmt(totalHeavies / appearances)}  ` +
      `heavy attempts ${fmt(totalHeavyAttempts / appearances)}  guard ${fmt(totalGuardSeconds / appearances)}s`,
  );
  console.log(
    `DEFLECT  ${totalDeflects} total = shield ${totalShieldCatches} + kit ${totalKitDeflects} + atom ${totalAtomBlocks}; ` +
      `shield ${fmt((100 * totalShieldCatches) / Math.max(1, totalShots))} per 100 shots, ` +
      `${fmt(totalShieldCatches / ROUNDS, 1)} per round; any ${fmt(
        (100 * totalReflectRounds) / appearances,
        0,
      )}% of player-rounds, shield ${fmt((100 * totalShieldRounds) / appearances, 0)}%; ` +
      `${fmt(totalDeflects / ROUNDS, 1)} all catches per round`,
  );
  if (totalDeflectEvents !== totalDeflects) {
    console.warn(`WARNING: ${totalDeflectEvents} DEFLECT events vs ${totalDeflects} telemetry catches`);
  }
  console.log(`\n${(((Date.now() - started) / 1000) | 0)}s wall\n`);
}

main();
