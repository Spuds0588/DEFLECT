import { EV, type GameEvent } from './types';

export type SessionMode =
  | 'training'
  | 'bots'
  | 'local'
  | 'gauntlet'
  | 'infection'
  | 'campaign'
  | 'host'
  | 'guest';

export type SessionOutcome =
  | 'match-complete'
  | 'game-complete'
  | 'series-complete'
  | 'ring-broken'
  | 'infection-clear'
  | 'infection-failed'
  | 'campaign-clear'
  | 'campaign-failed'
  | 'left'
  | 'playtest-complete';

export interface SessionDeflectCounts {
  guard: number;
  swing: number;
  beam: number;
  atom: number;
  net: number;
  arm: number;
  plow: number;
  broom: number;
  wave: number;
}

export interface SessionPlayerStats {
  slot: number;
  human: boolean;
  program: string;
  score: number;
  shots: number;
  dashes: number;
  swings: number;
  deflects: number;
  skills: number;
  heavies: number;
  hits: number;
  damage: number;
  kills: number;
  deaths: number;
}

export interface SessionRoundStats {
  arenaId: number;
  arenaName: string;
  round: number;
  duration: number;
  winnerSlot: number;
  matchWinner: number;
  players: SessionPlayerStats[];
  deflect: SessionDeflectCounts;
  fps: number;
  simMs: number;
}

export interface SessionPlayerSeed {
  slot: number;
  program: string;
  human: boolean;
}

export interface SessionSeries {
  game: number;
  total: number;
  mapRule: string;
}

export interface SessionCampaign {
  slot: number;
  level: number;
  node: string;
}

export interface SessionMeta {
  mode: SessionMode;
  arenaId: number;
  arenaName: string;
  program: string;
  localSlot: number;
  humanPlayers: number;
  bots: number;
  botTier: string | null;
  friendlyFire: boolean | null;
  autoLock: boolean;
  autoAttack: boolean;
  touch: boolean;
  online: boolean;
  infection: boolean;
  series: SessionSeries | null;
  campaign: SessionCampaign | null;
}

export interface SessionResult {
  outcome: SessionOutcome;
  winnerSlot: number | null;
  matchWinner: number | null;
  seriesGame: number | null;
  seriesTotal: number | null;
  wave: number | null;
  kills: number | null;
  seconds: number | null;
  score: number | null;
  cleared: boolean | null;
}

export interface SessionPerformance {
  samples: number;
  avgFps: number;
  minFps: number;
  avgFrameMs: number;
  maxFrameMs: number;
  avgSimMs: number;
  maxSimMs: number;
}

export interface SessionSummary {
  rounds: number;
  seconds: number;
  wins: number;
  losses: number;
  draws: number;
  shots: number;
  dashes: number;
  swings: number;
  deflects: number;
  skills: number;
  heavies: number;
  hits: number;
  damage: number;
  kills: number;
  deaths: number;
  avgFps: number;
  minFps: number;
  avgSimMs: number;
  maxSimMs: number;
}

export interface SessionEnvironment {
  viewportW: number;
  viewportH: number;
  dpr: number;
  hardwareConcurrency: number;
  touch: boolean;
  reducedMotion: boolean;
}

export interface SessionReport {
  schema: 1;
  kind: 'session';
  build: string;
  startedAt: string;
  endedAt: string;
  mode: SessionMode;
  setup: SessionMeta;
  result: SessionResult;
  rounds: SessionRoundStats[];
  summary: SessionSummary;
  perf: SessionPerformance;
  environment: SessionEnvironment;
  privacy: string;
}

export function emptyDeflect(): SessionDeflectCounts {
  return { guard: 0, swing: 0, beam: 0, atom: 0, net: 0, arm: 0, plow: 0, broom: 0, wave: 0 };
}

function cloneDeflect(source: SessionDeflectCounts): SessionDeflectCounts {
  return {
    guard: source.guard,
    swing: source.swing,
    beam: source.beam,
    atom: source.atom,
    net: source.net,
    arm: source.arm,
    plow: source.plow,
    broom: source.broom,
    wave: source.wave,
  };
}

function diffDeflect(now: SessionDeflectCounts, base: SessionDeflectCounts): SessionDeflectCounts {
  return {
    guard: now.guard - base.guard,
    swing: now.swing - base.swing,
    beam: now.beam - base.beam,
    atom: now.atom - base.atom,
    net: now.net - base.net,
    arm: now.arm - base.arm,
    plow: now.plow - base.plow,
    broom: now.broom - base.broom,
    wave: now.wave - base.wave,
  };
}

function clonePlayer(source: SessionPlayerStats): SessionPlayerStats {
  return {
    slot: source.slot,
    human: source.human,
    program: source.program,
    score: source.score,
    shots: source.shots,
    dashes: source.dashes,
    swings: source.swings,
    deflects: source.deflects,
    skills: source.skills,
    heavies: source.heavies,
    hits: source.hits,
    damage: source.damage,
    kills: source.kills,
    deaths: source.deaths,
  };
}

function diffPlayer(now: SessionPlayerStats, base: SessionPlayerStats | undefined): SessionPlayerStats {
  const prev = base ?? {
    slot: now.slot,
    human: now.human,
    program: now.program,
    score: 0,
    shots: 0,
    dashes: 0,
    swings: 0,
    deflects: 0,
    skills: 0,
    heavies: 0,
    hits: 0,
    damage: 0,
    kills: 0,
    deaths: 0,
  };
  return {
    slot: now.slot,
    human: now.human,
    program: now.program,
    score: now.score,
    shots: now.shots - prev.shots,
    dashes: now.dashes - prev.dashes,
    swings: now.swings - prev.swings,
    deflects: now.deflects - prev.deflects,
    skills: now.skills - prev.skills,
    heavies: now.heavies - prev.heavies,
    hits: now.hits - prev.hits,
    damage: Number((now.damage - prev.damage).toFixed(2)),
    kills: now.kills - prev.kills,
    deaths: now.deaths - prev.deaths,
  };
}

function roundNumber(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/**
 * Session-scoped, local-only capture. It records events the simulation already emits,
 * samples the frame loop, and produces a JSON report only when the player asks to share.
 * No callsigns, room codes, raw inputs or network state are stored here.
 */
export class SessionTracker {
  private readonly startedAtMs = Date.now();
  private readonly startedAt = new Date(this.startedAtMs).toISOString();
  private readonly players = new Map<number, SessionPlayerStats>();
  private readonly roundBase = new Map<number, SessionPlayerStats>();
  private rounds: SessionRoundStats[] = [];
  private round: SessionRoundStats | null = null;
  private roundDeflectBase = emptyDeflect();
  private perfSamples = 0;
  private fpsTotal = 0;
  private minFps = Infinity;
  private frameTotal = 0;
  private maxFrameMs = 0;
  private simTotal = 0;
  private maxSimMs = 0;

  constructor(
    private readonly buildStamp: string,
    private readonly meta: SessionMeta,
    seeds: readonly SessionPlayerSeed[],
  ) {
    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i];
      this.ensurePlayer(seed.slot, seed.program, seed.human);
    }
  }

  private ensurePlayer(slot: number, program = 'UNKNOWN', human = false): SessionPlayerStats {
    let player = this.players.get(slot);
    if (!player) {
      player = {
        slot,
        human,
        program,
        score: 0,
        shots: 0,
        dashes: 0,
        swings: 0,
        deflects: 0,
        skills: 0,
        heavies: 0,
        hits: 0,
        damage: 0,
        kills: 0,
        deaths: 0,
      };
      this.players.set(slot, player);
    } else {
      if (program !== 'UNKNOWN') player.program = program;
      if (human) player.human = true;
    }
    return player;
  }

  /** Merge the current authoritative/render roster into the report. */
  syncPlayers(players: readonly { slot: number; active: boolean; program: string; score: number }[]): void {
    for (let i = 0; i < players.length; i++) {
      const source = players[i];
      if (!source.active) continue;
      const player = this.ensurePlayer(source.slot, source.program);
      player.program = source.program;
      player.score = source.score;
    }
  }

  /** Record one replicated or local event. Event counts are per player. */
  recordEvent(event: GameEvent): void {
    if (event.kind === EV.ELIMINATED) {
      if (event.power >= 0) {
        const victim = this.ensurePlayer(event.power);
        victim.deaths++;
        if (event.slot >= 0 && event.slot !== event.power) this.ensurePlayer(event.slot).kills++;
      }
      return;
    }
    if (event.slot < 0) return;
    const player = this.ensurePlayer(event.slot);
    switch (event.kind) {
      case EV.SHOOT:
        player.shots++;
        break;
      case EV.DASH:
        player.dashes++;
        break;
      case EV.SWING:
        player.swings++;
        break;
      case EV.DEFLECT:
        player.deflects++;
        break;
      case EV.BUG:
        // Probe's armed mine reports a trigger with power 4; that is not a cast.
        if (event.power !== 4) player.skills++;
        break;
      case EV.LASER:
        player.heavies++;
        break;
      case EV.HIT:
        player.hits++;
        player.damage += event.power;
        break;
      default:
        break;
    }
  }

  /** Open a per-round delta window. Match mode calls this when live begins. */
  beginRound(arenaId: number, arenaName: string, round: number, deflectBase: SessionDeflectCounts): void {
    if (this.round) return;
    this.round = {
      arenaId,
      arenaName,
      round,
      duration: 0,
      winnerSlot: -1,
      matchWinner: -1,
      players: [],
      deflect: emptyDeflect(),
      fps: 0,
      simMs: 0,
    };
    this.roundBase.clear();
    for (const [slot, player] of this.players) this.roundBase.set(slot, clonePlayer(player));
    this.roundDeflectBase = cloneDeflect(deflectBase);
  }

  /** Close the current round and freeze its per-player action deltas. */
  finishRound(
    duration: number,
    winnerSlot: number,
    matchWinner: number,
    deflectNow: SessionDeflectCounts,
    fps: number,
    simMs: number,
  ): void {
    const round = this.round;
    if (!round) return;
    round.duration = roundNumber(Math.max(0, duration), 2);
    round.winnerSlot = winnerSlot;
    round.matchWinner = matchWinner;
    round.deflect = diffDeflect(deflectNow, this.roundDeflectBase);
    round.fps = Math.round(fps);
    round.simMs = roundNumber(simMs, 3);
    round.players = [];
    for (const [slot, player] of this.players) {
      round.players.push(diffPlayer(player, this.roundBase.get(slot)));
    }
    this.rounds.push(round);
    this.round = null;
  }

  sample(fps: number, frameMs: number, simMs: number): void {
    if (!Number.isFinite(fps) || !Number.isFinite(frameMs) || !Number.isFinite(simMs)) return;
    this.perfSamples++;
    this.fpsTotal += fps;
    this.minFps = Math.min(this.minFps, fps);
    this.frameTotal += frameMs;
    this.maxFrameMs = Math.max(this.maxFrameMs, frameMs);
    this.simTotal += simMs;
    this.maxSimMs = Math.max(this.maxSimMs, simMs);
  }

  elapsedSeconds(): number {
    return Math.max(0, (Date.now() - this.startedAtMs) / 1000);
  }

  private performance(): SessionPerformance {
    if (this.perfSamples === 0) {
      return {
        samples: 0,
        avgFps: 0,
        minFps: 0,
        avgFrameMs: 0,
        maxFrameMs: 0,
        avgSimMs: 0,
        maxSimMs: 0,
      };
    }
    return {
      samples: this.perfSamples,
      avgFps: roundNumber(this.fpsTotal / this.perfSamples, 1),
      minFps: roundNumber(this.minFps, 1),
      avgFrameMs: roundNumber(this.frameTotal / this.perfSamples, 2),
      maxFrameMs: roundNumber(this.maxFrameMs, 2),
      avgSimMs: roundNumber(this.simTotal / this.perfSamples, 3),
      maxSimMs: roundNumber(this.maxSimMs, 3),
    };
  }

  private summarize(seconds: number): SessionSummary {
    let shots = 0;
    let dashes = 0;
    let swings = 0;
    let deflects = 0;
    let skills = 0;
    let heavies = 0;
    let hits = 0;
    let damage = 0;
    let kills = 0;
    let deaths = 0;
    for (const player of this.players.values()) {
      shots += player.shots;
      dashes += player.dashes;
      swings += player.swings;
      deflects += player.deflects;
      skills += player.skills;
      heavies += player.heavies;
      hits += player.hits;
      damage += player.damage;
      kills += player.kills;
      deaths += player.deaths;
    }
    let wins = 0;
    let losses = 0;
    let draws = 0;
    for (let i = 0; i < this.rounds.length; i++) {
      const winner = this.rounds[i].winnerSlot;
      if (winner < 0) draws++;
      else if (winner === this.meta.localSlot) wins++;
      else losses++;
    }
    const perf = this.performance();
    return {
      rounds: this.rounds.length,
      seconds: roundNumber(seconds, 1),
      wins,
      losses,
      draws,
      shots,
      dashes,
      swings,
      deflects,
      skills,
      heavies,
      hits,
      damage: roundNumber(damage, 2),
      kills,
      deaths,
      avgFps: perf.avgFps,
      minFps: perf.minFps,
      avgSimMs: perf.avgSimMs,
      maxSimMs: perf.maxSimMs,
    };
  }

  build(result: SessionResult, environment: SessionEnvironment): SessionReport {
    let roundSeconds = 0;
    for (let i = 0; i < this.rounds.length; i++) roundSeconds += this.rounds[i].duration;
    const seconds = roundSeconds > 0 ? roundSeconds : result.seconds ?? this.elapsedSeconds();
    const rounds: SessionRoundStats[] = [];
    for (let i = 0; i < this.rounds.length; i++) {
      const round = this.rounds[i];
      const players: SessionPlayerStats[] = [];
      for (let p = 0; p < round.players.length; p++) players.push(clonePlayer(round.players[p]));
      rounds.push({ ...round, players, deflect: cloneDeflect(round.deflect) });
    }
    return {
      schema: 1,
      kind: 'session',
      build: this.buildStamp,
      startedAt: this.startedAt,
      endedAt: new Date().toISOString(),
      mode: this.meta.mode,
      setup: { ...this.meta, series: this.meta.series ? { ...this.meta.series } : null, campaign: this.meta.campaign ? { ...this.meta.campaign } : null },
      result: { ...result },
      rounds,
      summary: this.summarize(seconds),
      perf: this.performance(),
      environment: { ...environment },
      privacy: 'No callsigns, room codes, IP addresses or raw inputs are included.',
    };
  }
}

/** Compact text suitable for a share sheet or clipboard. The JSON carries the full detail. */
export function sessionShareText(report: SessionReport): string {
  const summary = report.summary;
  const result = report.result;
  const outcome = result.outcome.replace(/-/g, ' ').toUpperCase();
  const outcomeDetail =
    result.cleared === true
      ? ' // CLEARED'
      : result.cleared === false
        ? ' // FAILED'
        : result.wave !== null
          ? ` // WAVE ${result.wave}`
          : '';
  const rounds = summary.rounds > 0 ? `${summary.rounds} ROUNDS` : 'RUN';
  const record = summary.rounds > 0 ? ` // ${summary.wins}W ${summary.losses}L ${summary.draws}D` : '';
  return [
    `DEFLECT ${report.build} // ${report.mode.toUpperCase()} // ${report.setup.arenaName}`,
    `${outcome}${outcomeDetail} // ${rounds}${record} // ${formatClock(summary.seconds)}`,
    `P${report.setup.localSlot + 1} ${report.setup.program} // ${summary.shots} SHOTS // ${summary.deflects} CATCHES // ${summary.kills} KILLS // ${summary.deaths} DEATHS`,
    `PERF ${summary.avgFps.toFixed(0)} AVG / ${summary.minFps.toFixed(0)} MIN FPS // SIM ${summary.avgSimMs.toFixed(2)} AVG / ${summary.maxSimMs.toFixed(2)} MAX MS`,
    `${report.setup.humanPlayers} HUMAN // ${report.setup.bots} BOT // ${report.setup.autoLock ? 'AUTO LOCK' : 'MANUAL LOCK'} // ${report.setup.touch ? 'TOUCH' : 'KEYS/PAD'}`,
    'FULL JSON INCLUDED // NAMES OMITTED',
  ].join('\n');
}
