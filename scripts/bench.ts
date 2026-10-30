/**
 * Headless simulation benchmark. Run with `npm run bench`.
 * Measures ms per 60 Hz tick for representative player/projectile loads.
 * Rendering is measured separately in the browser with `?stress=N` + F3.
 */
import { CASCADING_ERROR, GAUNTLET, MAX_PLAYERS, SENTRY, SIM_DT } from '../src/game/config';
import { ARENAS } from '../src/game/arenas';
import { BotBrain } from '../src/game/bot';
import { ACTION, type InputFrame } from '../src/game/types';
import { World } from '../src/game/world';

interface Scenario {
  name: string;
  players: number;
  fireEvery: number;
  swing: boolean;
  invincible?: boolean;
  /** Candle spam keeps the projectile ceiling loaded despite the short bolt life. */
  candleEvery?: number;
}

const SCENARIOS: Scenario[] = [
  { name: '2P duel', players: 2, fireEvery: 40, swing: true },
  { name: '4P brawl', players: 4, fireEvery: 32, swing: true },
  { name: '8P stress', players: 8, fireEvery: 14, swing: true },
  { name: '8P max proj', players: 8, fireEvery: 4, swing: true, invincible: true, candleEvery: 10 },
  { name: '8P idle', players: 8, fireEvery: 0, swing: false },
];

const WARMUP = 400;
const MEASURE = 1800;

function newInputs(): InputFrame[] {
  return Array.from({ length: MAX_PLAYERS }, () => ({ mx: 0, my: 0, held: 0, pressed: 0 }));
}

function run(scenario: Scenario): void {
  const names = new Array(MAX_PLAYERS).fill('');
  for (let i = 0; i < scenario.players; i++) names[i] = `BOT ${i + 1}`;
  const world = new World('match', names, 0);
  world.phase = 'live';
  world.roundTimer = 90;
  const inputs = newInputs();
  const samples: number[] = [];
  let projectileSum = 0;

  const total = WARMUP + MEASURE;
  for (let t = 0; t < total; t++) {
    for (let i = 0; i < scenario.players; i++) {
      const f = inputs[i];
      f.mx = Math.cos(t * 0.019 + i * 1.7) * 0.9;
      f.my = Math.sin(t * 0.023 + i * 0.9) * 0.9;
      f.held = 0;
      f.pressed = 0;
      if (scenario.fireEvery > 0 && t % scenario.fireEvery === 0) f.pressed |= ACTION.BOLT;
      if (scenario.candleEvery && t % scenario.candleEvery === 0) f.pressed |= ACTION.CANDLE;
      if (scenario.swing && t % 47 === 0) f.pressed |= ACTION.SWING;
      if (t % 89 === 0) f.pressed |= ACTION.DASH;
      const p = world.players[i];
      p.energy = 100;
      p.hp = 999;
      p.maxHp = 999;
      if (scenario.invincible) p.iframes = 999;
    }

    const t0 = performance.now();
    world.step(SIM_DT, inputs);
    const elapsed = performance.now() - t0;
    world.clearEvents();

    if (t >= WARMUP) {
      samples.push(elapsed);
      let active = 0;
      for (let i = 0; i < world.projectiles.length; i++) if (world.projectiles[i].active) active++;
      projectileSum += active;
    }
  }

  samples.sort((a, b) => a - b);
  const sum = samples.reduce((a, b) => a + b, 0);
  const avg = sum / samples.length;
  const p99 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.99))];
  const max = samples[samples.length - 1];
  const avgProj = projectileSum / MEASURE;

  console.log(
    `${scenario.name.padEnd(12)} avg ${avg.toFixed(3)}ms  p99 ${p99.toFixed(3)}ms  max ${max.toFixed(
      3,
    )}ms  proj ${avgProj.toFixed(1)}`,
  );
}

function runGauntlet(): void {
  // The bench stresses the endless threat pool; a scored run would freeze on death.
  const world = new World('gauntlet', ['BENCH'], 0, ARENAS[0], true);
  const inputs: (InputFrame | null)[] = [{ mx: 0, my: 0, held: 0, pressed: 0 }];
  const priv = world as unknown as {
    spawnWorm: () => void;
    spawnVirus: (x: number, y: number) => unknown;
    spawnFirewall: () => void;
    spawnThrall: () => boolean;
    spawnErrorColony: () => void;
    spawnSentryPack: () => void;
  };
  const samples: number[] = [];
  let threatSum = 0;

  for (let t = 0; t < WARMUP + MEASURE; t++) {
    if (t % 45 === 0) {
      let worms = 0;
      for (const w of world.worms) if (w.active) worms++;
      for (let i = worms; i < 2; i++) priv.spawnWorm();
      let viruses = 0;
      for (const v of world.viruses) if (v.active) viruses++;
      for (let i = viruses; i < GAUNTLET.maxViruses; i++) priv.spawnVirus(200 + i * 70, 160 + (i % 4) * 110);
      let firewalls = 0;
      for (const f of world.firewalls) if (f.active) firewalls++;
      for (let i = firewalls; i < 2; i++) priv.spawnFirewall();
      if (!world.players[1].active) priv.spawnThrall();
      let errors = 0;
      for (const e of world.errors) if (e.active) errors++;
      if (errors === 0) priv.spawnErrorColony();
      let sentries = 0;
      for (const s of world.sentries) if (s.active) sentries++;
      if (sentries < SENTRY.max) priv.spawnSentryPack();
      // Keep the colony alive for the whole measurement: this is the max-load case.
      for (const e of world.errors) if (e.active) e.hp = 999;
    }
    const p = world.players[0];
    p.hp = 999;
    p.maxHp = 999;
    p.energy = 100;
    const thrall = world.players[1];
    if (thrall.active) {
      thrall.hp = 999;
      thrall.maxHp = 999;
    }
    inputs[0]!.mx = Math.cos(t * 0.019) * 0.9;
    inputs[0]!.my = Math.sin(t * 0.023) * 0.9;
    if (t % 22 === 0) inputs[0]!.pressed |= ACTION.BOLT;
    if (t % 67 === 0) inputs[0]!.pressed |= ACTION.SWING;

    const t0 = performance.now();
    world.step(SIM_DT, inputs);
    const elapsed = performance.now() - t0;
    world.clearEvents();

    if (t >= WARMUP) {
      samples.push(elapsed);
      let threats = 0;
      for (const w of world.worms) if (w.active) threats++;
      for (const v of world.viruses) if (v.active) threats++;
      for (const f of world.firewalls) if (f.active) threats++;
      for (const e of world.errors) if (e.active) threats++;
      for (const s of world.sentries) if (s.active) threats++;
      if (world.players[1].active) threats++;
      threatSum += threats;
    }
  }

  samples.sort((a, b) => a - b);
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const p99 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.99))];
  const max = samples[samples.length - 1];
  console.log(
    `Gauntlet max   avg ${avg.toFixed(3)}ms  p99 ${p99.toFixed(3)}ms  max ${max.toFixed(3)}ms  threats ${(
      threatSum / MEASURE
    ).toFixed(1)}  (${GAUNTLET.maxWorms}W/${GAUNTLET.maxViruses}V/2F/${CASCADING_ERROR.maxBlocks}E + sentries + thrall)`,
  );
}

function runBotSwarm(): void {
  const names = new Array(MAX_PLAYERS).fill('');
  for (let i = 0; i < MAX_PLAYERS; i++) names[i] = `BOT ${i + 1}`;
  const world = new World('match', names, 0);
  world.phase = 'live';
  world.roundTimer = 90;
  const inputs = newInputs();
  const brains = new Array(MAX_PLAYERS);
  for (let i = 0; i < MAX_PLAYERS; i++) brains[i] = new BotBrain(i, 'digital', i % 3, 0x51f15e + i * 131);
  const samples: number[] = [];
  let projectileSum = 0;

  for (let t = 0; t < WARMUP + MEASURE; t++) {
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const p = world.players[i];
      p.hp = 999;
      p.maxHp = 999;
      p.energy = 100;
    }
    const t0 = performance.now();
    for (let i = 0; i < MAX_PLAYERS; i++) brains[i].think(world, inputs[i], SIM_DT);
    world.step(SIM_DT, inputs);
    const elapsed = performance.now() - t0;
    world.clearEvents();
    if (t >= WARMUP) {
      samples.push(elapsed);
      let active = 0;
      for (let i = 0; i < world.projectiles.length; i++) if (world.projectiles[i].active) active++;
      projectileSum += active;
    }
  }

  samples.sort((a, b) => a - b);
  const sum = samples.reduce((a, b) => a + b, 0);
  const avg = sum / samples.length;
  const p99 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.99))];
  const max = samples[samples.length - 1];
  console.log(
    `8P bot swarm  avg ${avg.toFixed(3)}ms  p99 ${p99.toFixed(3)}ms  max ${max.toFixed(3)}ms  proj ${(projectileSum / MEASURE).toFixed(1)}  (AI + sim)`,
  );
}

console.log(`DEFLECT sim bench — ${MEASURE} measured ticks @ 60Hz after ${WARMUP} warmup\n`);
for (const scenario of SCENARIOS) run(scenario);
runBotSwarm();
runGauntlet();
console.log('\nBudget (AGENTS.md §7): avg sim tick under 4ms with 8 players and 48 live projectiles.');
