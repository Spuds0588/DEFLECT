/**
 * Local gauntlet score book. A run is ranked by the wave it reached, then by how
 * long it survived, then by kills. Records never enter the network snapshot.
 */
export interface GauntletRun {
  name: string;
  arenaId: number;
  wave: number;
  seconds: number;
  kills: number;
  at: number;
}

export interface GauntletRecordResult {
  runs: GauntletRun[];
  /** 1-based place in the kept records, or 0 when the run missed the table. */
  rank: number;
}

export const GAUNTLET_RECORDS_KEY = 'deflect.gauntlet.runs';
export const GAUNTLET_RECORD_LIMIT = 8;

function validNumber(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min;
}

function parseRun(value: unknown): GauntletRun | null {
  if (!value || typeof value !== 'object') return null;
  const run = value as Partial<GauntletRun>;
  if (typeof run.name !== 'string' || run.name.length === 0) return null;
  if (!validNumber(run.arenaId, 0)) return null;
  if (!validNumber(run.wave, 1)) return null;
  if (!validNumber(run.seconds, 0)) return null;
  if (!validNumber(run.kills, 0)) return null;
  if (!validNumber(run.at, 0)) return null;
  return {
    name: run.name.slice(0, 10),
    arenaId: Math.floor(run.arenaId),
    wave: Math.floor(run.wave),
    seconds: run.seconds,
    kills: Math.floor(run.kills),
    at: run.at,
  };
}

/** Highest wave first, then longest survival, then kills, then the older run. */
export function compareGauntletRuns(a: GauntletRun, b: GauntletRun): number {
  if (a.wave !== b.wave) return b.wave - a.wave;
  if (a.seconds !== b.seconds) return b.seconds - a.seconds;
  if (a.kills !== b.kills) return b.kills - a.kills;
  return a.at - b.at;
}

export function loadGauntletRuns(): GauntletRun[] {
  try {
    const raw = localStorage.getItem(GAUNTLET_RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const runs: GauntletRun[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const run = parseRun(parsed[i]);
      if (run) runs.push(run);
    }
    runs.sort(compareGauntletRuns);
    return runs.slice(0, GAUNTLET_RECORD_LIMIT);
  } catch {
    return [];
  }
}

export function saveGauntletRuns(runs: readonly GauntletRun[]): void {
  try {
    localStorage.setItem(GAUNTLET_RECORDS_KEY, JSON.stringify(runs));
  } catch {
    /* storage disabled: the table stays in memory for this session */
  }
}

export function recordGauntletRun(
  runs: readonly GauntletRun[],
  run: GauntletRun,
): GauntletRecordResult {
  const next = runs.slice();
  next.push(run);
  next.sort(compareGauntletRuns);
  const kept = next.slice(0, GAUNTLET_RECORD_LIMIT);
  return { runs: kept, rank: kept.indexOf(run) + 1 };
}

/** `m:ss`; runs longer than an hour keep counting minutes rather than adding an hour field. */
export function formatGauntletTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
