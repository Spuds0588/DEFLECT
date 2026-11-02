/**
 * Wedge heavy probe. Measures the real bot-piloted plow in the attract setup and a
 * forced controlled fire, including charge time, active time and hits.
 *
 * Not shipped. Temporary measurement harness for the charge-plow question.
 */
import { ARENAS, type ArenaDef } from '../src/game/arenas';
import { BotBrain } from '../src/game/bot';
import { SIM_DT, WEDGE } from '../src/game/config';
import { PROGRAM_ID } from '../src/game/programs';
import { ACTION, type InputFrame, type Player } from '../src/game/types';
import { World } from '../src/game/world';

function frame(): InputFrame {
  return { mx: 0, my: 0, held: 0, pressed: 0 };
}

function popcount(n: number): number {
  let total = 0;
  while (n > 0) {
    total += n & 1;
    n >>>= 1;
  }
  return total;
}

function heavyHits(p: Player): number {
  return (
    popcount(p.wedgeHitPlayers) +
    popcount(p.wedgeHitWorms) +
    popcount(p.wedgeHitViruses) +
    popcount(p.wedgeHitErrors) +
    popcount(p.wedgeHitSentries) +
    (p.wedgeHitDrone ? 1 : 0)
  );
}

interface NaturalResult {
  attempts: number;
  fires: number;
  cancels: number;
  hits: number;
  alive: number;
  chargeTimes: number[];
  activeTimes: number[];
}

function runNatural(wave: number, arena: ArenaDef, seed: number, cap = 40): NaturalResult {
  const w = new World('gauntlet', ['WEDGE'], 0, arena, false, PROGRAM_ID.WEDGE);
  if (wave > 1) w.seedAttractRun(wave);
  const brain = new BotBrain(0, 'digital', 0, seed);
  const input = frame();
  const result: NaturalResult = {
    attempts: 0,
    fires: 0,
    cancels: 0,
    hits: 0,
    alive: 0,
    chargeTimes: [],
    activeTimes: [],
  };
  let t = 0;
  let lastHeld = false;
  let lastWedge = 0;
  let chargeStart = 0;
  let activeStart = 0;
  let countedFireHits = false;

  while (t < cap && !w.gauntletOver) {
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

    if (!lastHeld && now.laserChargeHeld) {
      result.attempts++;
      chargeStart = t;
      countedFireHits = false;
    }
    if (lastHeld && !now.laserChargeHeld && now.wedgeT <= 0) {
      result.cancels++;
    }
    if (lastWedge <= 0 && now.wedgeT > 0) {
      result.fires++;
      result.chargeTimes.push(t - chargeStart);
      activeStart = t;
    }
    if (lastWedge > 0 && now.wedgeT <= 0 && !countedFireHits) {
      result.hits += heavyHits(now);
      result.activeTimes.push(t - activeStart);
      countedFireHits = true;
    }

    lastHeld = now.laserChargeHeld;
    lastWedge = now.wedgeT;
    t += SIM_DT;
  }

  result.alive = t;
  // A plow still active at the cap would otherwise be missed.
  if (lastWedge > 0) result.hits += heavyHits(w.players[0]);
  return result;
}

function natural(): void {
  const arenas = [ARENAS[0], ARENAS[1], ARENAS[7], ARENAS[9]];
  console.log('\nWEDGE PLOW — natural bot attact runs, 40s cap\n');
  console.log('MAP        WAVE  RUNS  ATTEMPT  FIRE  CANCEL  HIT  AVG ALIVE  FIRE TIME  ACTIVE');
  for (const wave of [8, 24, 72]) {
    for (const arena of arenas) {
      const rows: NaturalResult[] = [];
      for (let seed = 0; seed < 5; seed++) {
        rows.push(runNatural(wave, arena, 0x51f15e + arena.id * 977 + wave * 131 + seed * 7919));
      }
      const sum = (f: (r: NaturalResult) => number): number => rows.reduce((n, r) => n + f(r), 0);
      const fires = sum((r) => r.fires);
      const attempts = sum((r) => r.attempts);
      const charge = rows.flatMap((r) => r.chargeTimes);
      const active = rows.flatMap((r) => r.activeTimes);
      console.log(
        `${arena.name.slice(0, 10).padEnd(10)} ${String(wave).padStart(4)}  ${String(rows.length).padStart(4)}  ${String(
          attempts,
        ).padStart(7)}  ${String(fires).padStart(4)}  ${String(sum((r) => r.cancels)).padStart(6)}  ${String(
          sum((r) => r.hits),
        ).padStart(3)}  ${(sum((r) => r.alive) / rows.length).toFixed(1).padStart(9)}  ${(
          charge.reduce((a, b) => a + b, 0) / Math.max(1, charge.length)
        )
          .toFixed(3)
          .padStart(9)}  ${(active.reduce((a, b) => a + b, 0) / Math.max(1, active.length)).toFixed(3).padStart(6)}`,
      );
    }
  }
}

interface ForcedResult {
  charge: number;
  active: number;
  hit: boolean;
  travel: number;
}

function runForced(targetDistance: number, variant: { chargeTime: number; chargeDuration: number; chargeSpeed: number }): ForcedResult {
  const old = { chargeTime: WEDGE.chargeTime, chargeDuration: WEDGE.chargeDuration, chargeSpeed: WEDGE.chargeSpeed };
  WEDGE.chargeTime = variant.chargeTime;
  WEDGE.chargeDuration = variant.chargeDuration;
  WEDGE.chargeSpeed = variant.chargeSpeed;
  const arena = ARENAS[0];
  const w = new World('match', ['WEDGE', 'DUMMY'], 0, arena, false, PROGRAM_ID.WEDGE, 1, [PROGRAM_ID.PROBE]);
  const wedge = w.players[0];
  const dummy = w.players[1];
  wedge.x = (arena.bounds.left + arena.bounds.right) * 0.5 - 120;
  wedge.y = (arena.bounds.top + arena.bounds.bottom) * 0.5;
  dummy.x = wedge.x + targetDistance;
  dummy.y = wedge.y;
  wedge.facing = 0;
  const input = frame();
  let charge = -1;
  let active = 0;
  let hit = false;
  let t = 0;
  let fired = false;
  const startHp = dummy.hp;
  while (t < 3) {
    // Keep the target inert and the attacker aimed down +x. The request is a timing
    // probe, not a bot-vs-bot duel. Repress every frame because World clears `pressed`.
    input.mx = 1;
    input.held = ACTION.CANDLE;
    input.pressed = ACTION.CANDLE;
    const dummyInput = frame();
    w.step(SIM_DT, [input, dummyInput]);
    w.clearEvents();
    t += SIM_DT;
    if (!fired && wedge.wedgeT > 0) {
      charge = t;
      fired = true;
    }
    if (fired && wedge.wedgeT > 0) active += SIM_DT;
    if (dummy.hp < startHp) hit = true;
  }
  const result = { charge, active, hit, travel: targetDistance };
  WEDGE.chargeTime = old.chargeTime;
  WEDGE.chargeDuration = old.chargeDuration;
  WEDGE.chargeSpeed = old.chargeSpeed;
  return result;
}

function forced(): void {
  console.log('\nWEDGE PLOW — forced point-blank timing probe\n');
  console.log('VARIANT                 CHARGE  ACTIVE  HIT  DIST');
  const variants = [
    { name: 'live 0.56 / 0.50', chargeTime: 0.56, chargeDuration: 0.5, chargeSpeed: 690 },
    { name: 'charge 0.40 / 0.65', chargeTime: 0.4, chargeDuration: 0.65, chargeSpeed: 690 },
    { name: 'charge 0.35 / 0.80', chargeTime: 0.35, chargeDuration: 0.8, chargeSpeed: 690 },
    { name: 'live charge / 0.80', chargeTime: 0.56, chargeDuration: 0.8, chargeSpeed: 690 },
    { name: 'live charge / 0.65', chargeTime: 0.4, chargeDuration: 0.65, chargeSpeed: 760 },
  ];
  for (const v of variants) {
    const r = runForced(220, v);
    console.log(
      `${v.name.padEnd(23)} ${r.charge.toFixed(3).padStart(6)}  ${r.active.toFixed(3).padStart(6)}  ${
        r.hit ? 'YES' : 'NO '
      }  ${String(r.travel).padStart(4)}`,
    );
  }
}

natural();
forced();
