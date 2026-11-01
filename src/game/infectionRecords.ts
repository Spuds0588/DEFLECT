/**
 * Local INFECTION best times. One record per arena: a clean sweep keeps the fastest
 * clear. The table is a solo speed-run book, not a leaderboard, and it never enters the
 * network snapshot.
 */
export interface InfectionBest {
  name: string;
  arenaId: number;
  /** Seconds from the first frame of the run to the last virus deleted. */
  seconds: number;
  kills: number;
  at: number;
}

export interface InfectionRecordResult {
  bests: InfectionBest[];
  /** True when the run beat the stored time for that arena (or set the first one). */
  improved: boolean;
}

export const INFECTION_BEST_KEY = 'deflect.infection.bests';

function validNumber(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min;
}

function parseBest(value: unknown): InfectionBest | null {
  if (!value || typeof value !== 'object') return null;
  const best = value as Partial<InfectionBest>;
  if (typeof best.name !== 'string' || best.name.length === 0) return null;
  if (!validNumber(best.arenaId, 0)) return null;
  if (!validNumber(best.seconds, 0)) return null;
  if (!validNumber(best.kills, 0)) return null;
  if (!validNumber(best.at, 0)) return null;
  return {
    name: best.name.slice(0, 10),
    arenaId: Math.floor(best.arenaId),
    seconds: best.seconds,
    kills: Math.floor(best.kills),
    at: best.at,
  };
}

export function loadInfectionBests(): InfectionBest[] {
  try {
    const raw = localStorage.getItem(INFECTION_BEST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const bests: InfectionBest[] = [];
    const seen = new Set<number>();
    for (let i = 0; i < parsed.length; i++) {
      const best = parseBest(parsed[i]);
      if (!best || seen.has(best.arenaId)) continue;
      seen.add(best.arenaId);
      bests.push(best);
    }
    return bests;
  } catch {
    return [];
  }
}

export function saveInfectionBests(bests: readonly InfectionBest[]): void {
  try {
    localStorage.setItem(INFECTION_BEST_KEY, JSON.stringify(bests));
  } catch {
    /* storage disabled: the table stays in memory for this session */
  }
}

export function bestForArena(bests: readonly InfectionBest[], arenaId: number): InfectionBest | null {
  for (let i = 0; i < bests.length; i++) if (bests[i].arenaId === arenaId) return bests[i];
  return null;
}

/** The fastest clean sweep across every arena, for the title menu readout. */
export function fastestBest(bests: readonly InfectionBest[]): InfectionBest | null {
  let best: InfectionBest | null = null;
  for (let i = 0; i < bests.length; i++) {
    if (!best || bests[i].seconds < best.seconds) best = bests[i];
  }
  return best;
}

export function recordInfectionClear(
  bests: readonly InfectionBest[],
  run: InfectionBest,
): InfectionRecordResult {
  const next = bests.slice();
  let slot = -1;
  for (let i = 0; i < next.length; i++) {
    if (next[i].arenaId === run.arenaId) {
      slot = i;
      break;
    }
  }
  if (slot < 0) {
    next.push(run);
    return { bests: next, improved: true };
  }
  if (run.seconds >= next[slot].seconds) return { bests: next, improved: false };
  next[slot] = run;
  return { bests: next, improved: true };
}

/** `m:ss.d`; the tenths matter because a clear can be won by a fraction of a second. */
export function formatInfectionTime(seconds: number): string {
  const total = Math.max(0, seconds);
  const whole = Math.floor(total);
  const tenths = Math.floor((total - whole) * 10);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}.${tenths}`;
}
