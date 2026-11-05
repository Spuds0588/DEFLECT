/**
 * Local story-mode save slots for SECTORS.
 *
 * Three local slots back the campaign. A completed level calls `saveStoryProgress`, and
 * the save screen can `clearStorySlot` after its own confirmation. This module owns the
 * slot format and storage; it does not decide when a run starts or resumes.
 */
export const STORY_SLOT_COUNT = 3;
export const STORY_SAVE_VERSION = 1;
/** Bump when authored level order changes; old slots migrate against this. */
export const STORY_ROUTE_VERSION = 2;

export interface StorySave {
  version: number;
  /** Program picked for the run. A resumed slot restores this instead of the menu pick. */
  program: number;
  /** Index into `SECTORS`: the system the run is currently in. */
  sector: number;
  /** Node id inside that sector the run would resume on. */
  nodeId: string;
  /** Levels completed inside the campaign so far. */
  level: number;
  /** Authored route revision this slot was saved against. Missing on pre-v0.1.204 slots. */
  routeVersion: number;
  /** Human players in the run. The slot readout shows this instead of the programs. */
  players: number;
  /** Bot companions chosen for the run, 0-3. Bots take programs the players did not pick. */
  bots: number;
  /** Seconds of campaign play, for the slot readout. */
  playSeconds: number;
  /** Best end-of-level score across this slot's clears. */
  bestScore: number;
  /** Clean sweeps earned, one per level cleared without losing a data crate. */
  cleanSweeps: number;
  /** Memory stacks per slot at the save point. Absent on older saves. */
  memory?: number[];
  /** Uncollected memory shards, as fractions of the arena bounds. */
  shards?: { x: number; y: number }[];
  /** Bot slots already lost in this run, bit 1 = slot 1. Absent on older saves. */
  deadBots?: number;
  updatedAt: number;
}

const KEY = 'deflect.story.saves';

export function loadStorySlots(): (StorySave | null)[] {
  const slots: (StorySave | null)[] = new Array(STORY_SLOT_COUNT).fill(null);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return slots;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return slots;
    for (let i = 0; i < STORY_SLOT_COUNT; i++) {
      const entry = parsed[i] as Partial<StorySave> | null | undefined;
      if (!entry || typeof entry !== 'object') continue;
      if (typeof entry.sector !== 'number' || typeof entry.nodeId !== 'string') continue;
      if (!Number.isFinite(entry.sector) || entry.sector < 0) continue;
      slots[i] = {
        version: STORY_SAVE_VERSION,
        program: typeof entry.program === 'number' ? entry.program : 0,
        sector: Math.floor(entry.sector),
        nodeId: entry.nodeId,
        level: typeof entry.level === 'number' ? Math.max(0, Math.floor(entry.level)) : 0,
        routeVersion:
          typeof entry.routeVersion === 'number' && Number.isFinite(entry.routeVersion)
            ? Math.max(1, Math.floor(entry.routeVersion))
            : 1,
        players: typeof entry.players === 'number' ? Math.max(1, Math.min(4, Math.floor(entry.players))) : 1,
        bots: typeof entry.bots === 'number' ? Math.max(0, Math.min(3, Math.floor(entry.bots))) : 0,
        playSeconds: typeof entry.playSeconds === 'number' ? Math.max(0, entry.playSeconds) : 0,
        bestScore: typeof entry.bestScore === 'number' ? Math.max(0, Math.floor(entry.bestScore)) : 0,
        cleanSweeps: typeof entry.cleanSweeps === 'number' ? Math.max(0, Math.floor(entry.cleanSweeps)) : 0,
        memory: Array.isArray(entry.memory)
          ? entry.memory
              .slice(0, 4)
              .map((n) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(3, Math.floor(n))) : 0))
          : undefined,
        shards: Array.isArray(entry.shards)
          ? entry.shards
              .filter((shard): shard is { x: number; y: number } =>
                !!shard && typeof shard === 'object' && Number.isFinite(shard.x) && Number.isFinite(shard.y),
              )
              .slice(0, 8)
              .map((shard) => ({ x: Math.max(0, Math.min(1, shard.x)), y: Math.max(0, Math.min(1, shard.y)) }))
          : undefined,
        deadBots:
          typeof entry.deadBots === 'number' && Number.isFinite(entry.deadBots)
            ? Math.max(0, Math.floor(entry.deadBots)) & 0xfe
            : undefined,
        updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : 0,
      };
    }
  } catch {
    /* Storage disabled or the payload is corrupt: every slot reads empty. */
  }
  return slots;
}

function writeStorySlots(slots: (StorySave | null)[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(slots.slice(0, STORY_SLOT_COUNT)));
  } catch {
    /* Storage disabled: the run continues, it just will not resume. */
  }
}

/**
 * Called after a level completes. A new run creates the slot, a resumed run overwrites
 * it, so the save always points at the next level rather than the one just cleared.
 */
export function saveStoryProgress(
  slot: number,
  save: Omit<StorySave, 'version' | 'routeVersion' | 'updatedAt'>,
): void {
  if (slot < 0 || slot >= STORY_SLOT_COUNT) return;
  const slots = loadStorySlots();
  slots[slot] = {
    ...save,
    version: STORY_SAVE_VERSION,
    routeVersion: STORY_ROUTE_VERSION,
    updatedAt: Date.now(),
  };
  writeStorySlots(slots);
}

/** Remove one slot. The menu confirms before calling; an empty slot is a no-op. */
export function clearStorySlot(slot: number): void {
  if (slot < 0 || slot >= STORY_SLOT_COUNT) return;
  const slots = loadStorySlots();
  slots[slot] = null;
  writeStorySlots(slots);
}
