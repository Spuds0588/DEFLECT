/**
 * Solo campaign bot audit.
 *
 * One local body, no companions, no harness flight. Slot 0 is driven by the shipped
 * IMPOSSIBLE BotBrain, tutorials are skipped the way the on-screen SKIP TUTORIAL button
 * skips them, and every node is run independently with a fixed time budget. The summary
 * names the first reason a node cannot finish: death, stall, missing objective, or a
 * clear.
 *
 * Run:
 *   npx tsx .tmp/campaign-solo-bot-check.ts
 *   LEVEL=9 STYLE=2 SECONDS=180 npx tsx .tmp/campaign-solo-bot-check.ts
 */
import { ARENAS } from '../src/game/arenas';
import {
  PLAYABLE_CAMPAIGN_LEVELS,
  campaignChapterForLevel,
  type CampaignLevel,
} from '../src/game/campaign';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';
import { BotBrain } from '../src/game/bot';
import { PROGRAMS, PROGRAM_ID } from '../src/game/programs';
import { World } from '../src/game/world';
import type { InputFrame } from '../src/game/types';

const fail = (message: string): never => {
  throw new Error(message);
};

const parseEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

const SECONDS = parseEnv('SECONDS', 240);
const ONLY = parseEnv('LEVEL', -1);
const STYLE = parseEnv('STYLE', 2);
const PROGRAM = parseEnv('PROGRAM', PROGRAM_ID.PROBE);
const BOTS = Math.max(0, Math.min(3, Math.round(parseEnv('BOTS', 0))));
const PLAYERS = BOTS + 1;
const SEED_BASE = parseEnv('SEED', 0x51f15e);
const INVULN = parseEnv('INVULN', 0) !== 0;
const DEBUG_BOSS = parseEnv('DEBUG_BOSS', 0) !== 0;
const DEBUG_FALL = parseEnv('DEBUG_FALL', 0) !== 0;
const MAX_TICKS = Math.round(SECONDS / SIM_DT);

type Failure = {
  level: number;
  name: string;
  arena: string;
  reason: 'death' | 'failed' | 'timeout' | 'invalid';
  details: Record<string, unknown>;
};

const failures: Failure[] = [];
const clears: Record<string, unknown>[] = [];

/** Same program assignment as the campaign: companions take the kits the host left unused. */
function botProgramList(count: number, selected: number): number[] {
  const unused: number[] = [];
  for (const program of PROGRAMS) if (program.id !== selected) unused.push(program.id);
  const list: number[] = [];
  for (let slot = 1; slot <= count; slot++) {
    list[slot] = unused.length > 0 ? unused[(slot - 1) % unused.length] : PROGRAM_ID.PROBE;
  }
  return list;
}

function liveHostiles(world: World): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const [family, list] of [
    ['worm', world.worms],
    ['virus', world.viruses],
    ['sentry', world.sentries],
    ['error', world.errors],
  ] as const) {
    for (const body of list as any[]) {
      if (!body.active) continue;
      out.push({
        family,
        kind: body.kind ?? body.bossKind ?? -1,
        held: body.held === true,
        hp: body.hp === undefined ? -1 : Math.round(body.hp),
        d: Math.round(Math.hypot(body.x - world.players[0].x, body.y - world.players[0].y)),
        shape: body.shapeState ?? -1,
      });
    }
  }
  return out;
}

function snapshot(world: World, brain: BotBrain, tick: number): Record<string, unknown> {
  const p = world.players[0];
  const priv = world as any;
  const boss = world.worms.find((w) => w.active && w.bossKind >= 0);
  const ports = world.props.filter((b) => b.active && b.portal && !b.portalExit);
  return {
    at: +(tick * SIM_DT).toFixed(1),
    phase: world.phase,
    campaignPhase: world.campaignPhase,
    arena: world.arena.name,
    arenaId: world.arena.id,
    hp: p.hp,
    maxHp: p.maxHp,
    alive: p.alive,
    party: world.players.slice(0, PLAYERS).map((body) => ({ slot: body.slot, active: body.active, alive: body.alive, hp: body.hp, program: body.program })),
    killer: p.killerKind,
    pos: `${Math.round(p.x)},${Math.round(p.y)}`,
    fallT: +p.fallT.toFixed(2),
    dashT: +p.dashT.toFixed(2),
    kx: Math.round(p.kx),
    ky: Math.round(p.ky),
    kills: world.gauntletKills,
    need: world.campaignKillsToClear,
    ports: `${ports.length} live / ${world.portTotal} total / ${world.portsClosed} closed`,
    exitReady: world.campaignExitReady,
    portalT: +world.campaignPortalT.toFixed(2),
    boss: boss ? { kind: boss.bossKind, hp: Math.round(boss.hp), x: Math.round(boss.x), y: Math.round(boss.y), fly: boss.flyPhase } : null,
    campaignBoss: world.campaignBoss,
    portTotal: world.portTotal,
    bossSpawned: priv.campaignBossSpawned,
    bossWarn: priv.campaignBossWarned,
    tutorial: world.tutorial ? { done: world.tutorial.done, id: world.tutorial.current?.id ?? null } : null,
    skill: priv.campaignSkillLessonTaught,
    branch: (brain as any).steerBranch,
    target: (brain as any).target,
    hostile: (brain as any).hostileKind,
    hostiles: liveHostiles(world).slice(0, 16),
  };
}

function makeWorld(level: CampaignLevel): World {
  const arena = ARENAS.find((a) => a.id === level.arenaId);
  if (!arena) fail(`${level.name}: arena ${level.arenaId} is missing`);
  const names = new Array<string>(MAX_PLAYERS).fill('');
  names[0] = 'AUDIT-HOST';
  for (let i = 1; i <= BOTS; i++) names[i] = `AUDIT-BOT-${i}`;
  return new World(
    'gauntlet',
    names,
    0,
    arena,
    false,
    PROGRAM,
    BOTS,
    botProgramList(BOTS, PROGRAM),
    true,
    level.dataCrates,
    false,
    level.intro,
    level.clearKills,
    false,
    level.boss ?? -1,
    campaignChapterForLevel(level),
    level.opening ?? null,
    level.finale === true,
    0,
    level.blurb ?? null,
  );
}

function audit(level: CampaignLevel): void {
  const world = makeWorld(level);
  const p = world.players[0];
  const brain = new BotBrain(0, 'impossible', STYLE, SEED_BASE + level.id * 7919 + 17);
  const brains: (BotBrain | null)[] = new Array(MAX_PLAYERS).fill(null);
  brains[0] = brain;
  for (let i = 1; i <= BOTS; i++) {
    brains[i] = new BotBrain(i, 'impossible', i - 1, SEED_BASE + level.id * 7919 + i * 131);
  }
  const frames: InputFrame[] = Array.from({ length: MAX_PLAYERS }, () => ({ mx: 0, my: 0, held: 0, pressed: 0 }));
  const inputs: (InputFrame | null)[] = frames;
  const frame = frames[0];
  let tick = 0;
  let skips = 0;
  let deaths = 0;
  let wasAlive = p.alive;
  let lastPhase = world.campaignPhase;
  let lastHp = p.hp;
  let nextLog = 0;
  let lastDamageAt = -1;
  let lastDamageFrom = 0;
  let fallFrames = 0;

  const start = snapshot(world, brain, tick);
  console.log(`START ${JSON.stringify({ level: level.id, name: level.name, arena: world.arena.name, intro: level.intro, boss: level.boss ?? -1, ...start })}`);

  while (tick < MAX_TICKS) {
    if (DEBUG_BOSS && world.worms.some((w) => w.active && w.bossKind >= 0) && tick % 300 === 0) {
      const w = world.worms.find((x) => x.active && x.bossKind >= 0)!;
      console.log(
        `BOSS ${JSON.stringify({
          at: +(tick * SIM_DT).toFixed(1),
          x: Math.round(w.x),
          y: Math.round(w.y),
          fly: w.flyPhase,
          flyT: +(w.flyT ?? -1).toFixed(2),
          spawnT: +(w.spawnT ?? -1).toFixed(2),
          entryT: +(w.entryT ?? -1).toFixed(2),
          pinT: +(w.pinT ?? -1).toFixed(2),
          angle: +(w.angle ?? 0).toFixed(2),
          vx: Math.round(w.vx ?? 0),
          vy: Math.round(w.vy ?? 0),
          pass: w.megaPass ?? -1,
          anchor: `${Math.round(w.anchorX ?? -1)},${Math.round(w.anchorY ?? -1)}`,
          intro: world.bossIntro?.kind ?? null,
          introT: +(world.bossIntro?.t ?? -1).toFixed(2),
        })}`,
      );
    }
    if (INVULN) p.iframes = 1e9;
    if (world.tutorial && !world.tutorial.done) {
      world.skipTutorial();
      skips++;
    }

    for (let i = 0; i < PLAYERS; i++) {
      const body = world.players[i];
      const slotBrain = brains[i];
      const slotFrame = frames[i];
      if (slotBrain && body.active && body.alive) {
        slotBrain.think(world, slotFrame, SIM_DT);
      } else {
        slotFrame.mx = 0;
        slotFrame.my = 0;
        slotFrame.held = 0;
        slotFrame.pressed = 0;
      }
    }

    if (DEBUG_FALL && (p.fallT > 0 || world.offFloor(p.x, p.y))) {
      fallFrames++;
      const off = world.offFloor(p.x, p.y);
      console.log(`FALL ${JSON.stringify({
        at: +(tick * SIM_DT).toFixed(2),
        pos: `${p.x.toFixed(1)},${p.y.toFixed(1)}`,
        off,
        fallT: +p.fallT.toFixed(2),
        dashT: +p.dashT.toFixed(2),
        kx: Math.round(p.kx),
        ky: Math.round(p.ky),
        out: `${frame.mx.toFixed(2)},${frame.my.toFixed(2)}`,
        held: frame.held,
        pressed: frame.pressed,
        branch: (brain as any).steerBranch,
      })}`);
    }

    const hpBefore = p.hp;
    world.step(SIM_DT, inputs);
    tick++;
    if (INVULN) p.iframes = 1e9;

    if (p.hp < hpBefore) {
      lastDamageAt = tick;
      lastDamageFrom = hpBefore - p.hp;
    }
    if (wasAlive && !p.alive) {
      deaths++;
      console.log(`DEATH ${JSON.stringify({ level: level.name, deaths, ...snapshot(world, brain, tick) })}`);
      if (DEBUG_FALL) console.log(`FALLFRAMES ${fallFrames}`);
    }
    wasAlive = p.alive;
    if (p.hp !== lastHp) lastHp = p.hp;

    if (world.campaignPhase !== lastPhase) {
      const phase = snapshot(world, brain, tick);
      console.log(`PHASE ${JSON.stringify({ level: level.name, from: lastPhase, to: world.campaignPhase, ...phase })}`);
      lastPhase = world.campaignPhase;
    }

    if (world.campaignPhase === 'cleared') {
      const result = {
        level: level.id,
        name: level.name,
        arena: world.arena.name,
        seconds: +(tick * SIM_DT).toFixed(1),
        deaths,
        skips,
        hp: p.hp,
        maxHp: p.maxHp,
        kills: world.gauntletKills,
      };
      clears.push(result);
      console.log(`CLEAR ${JSON.stringify(result)}`);
      return;
    }
    if (world.campaignPhase === 'failed' || world.gauntletOver) {
      const details = {
        ...snapshot(world, brain, tick),
        deaths,
        skips,
        lastDamageAt: lastDamageAt < 0 ? -1 : +(lastDamageAt * SIM_DT).toFixed(1),
        lastDamageFrom,
      };
      failures.push({ level: level.id, name: level.name, arena: world.arena.name, reason: world.campaignPhase === 'failed' ? 'death' : 'failed', details });
      console.log(`FAIL ${JSON.stringify({ level: level.id, name: level.name, reason: world.campaignPhase === 'failed' ? 'death' : 'failed', ...details })}`);
      return;
    }

    if (tick >= nextLog) {
      console.log(`TICK ${JSON.stringify({ level: level.name, ...snapshot(world, brain, tick) })}`);
      nextLog = tick + Math.round(30 / SIM_DT);
    }
  }

  const details = { ...snapshot(world, brain, tick), deaths, skips, lastDamageAt: lastDamageAt < 0 ? -1 : +(lastDamageAt * SIM_DT).toFixed(1), lastDamageFrom };
  failures.push({ level: level.id, name: level.name, arena: world.arena.name, reason: 'timeout', details });
  console.log(`TIMEOUT ${JSON.stringify({ level: level.id, name: level.name, ...details })}`);
}

const levels = ONLY >= 0
  ? PLAYABLE_CAMPAIGN_LEVELS.filter((level) => level.id === ONLY)
  : PLAYABLE_CAMPAIGN_LEVELS;
if (levels.length === 0) fail(`no campaign level matched LEVEL=${ONLY}`);

console.log(`campaign: ${levels.length} level(s), ${PLAYERS} player(s), IMPOSSIBLE tier, host style ${STYLE}, host program ${PROGRAM}, budget ${SECONDS}s each, tutorials skipped`);
for (const level of levels) audit(level);

console.log('SUMMARY ' + JSON.stringify({ cleared: clears.length, failed: failures.length, total: levels.length, clears, failures }));
if (failures.length > 0) {
  for (const f of failures) {
    console.log(`BLOCKER level ${f.level} ${f.name} (${f.arena}): ${f.reason} // ${JSON.stringify(f.details)}`);
  }
  process.exitCode = 1;
}
