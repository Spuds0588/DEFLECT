/**
 * Local story-mode save slots for SECTORS.
 *
 * The campaign is not playable yet, so nothing writes a save during a run. This module
 * owns the slot format and storage so the menu can list slots and the first playable
 * sector only has to call `saveStoryProgress` after a level completes.
 */
export const STORY_SLOT_COUNT = 3;
export const STORY_SAVE_VERSION = 1;

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
        players: typeof entry.players === 'number' ? Math.max(1, Math.min(4, Math.floor(entry.players))) : 1,
        bots: typeof entry.bots === 'number' ? Math.max(0, Math.min(3, Math.floor(entry.bots))) : 0,
        playSeconds: typeof entry.playSeconds === 'number' ? Math.max(0, entry.playSeconds) : 0,
        bestScore: typeof entry.bestScore === 'number' ? Math.max(0, Math.floor(entry.bestScore)) : 0,
        cleanSweeps: typeof entry.cleanSweeps === 'number' ? Math.max(0, Math.floor(entry.cleanSweeps)) : 0,
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
export function saveStoryProgress(slot: number, save: Omit<StorySave, 'version' | 'updatedAt'>): void {
  if (slot < 0 || slot >= STORY_SLOT_COUNT) return;
  const slots = loadStorySlots();
  slots[slot] = { ...save, version: STORY_SAVE_VERSION, updatedAt: Date.now() };
  writeStorySlots(slots);
}

export function clearStorySlot(slot: number): void {
  if (slot < 0 || slot >= STORY_SLOT_COUNT) return;
  const slots = loadStorySlots();
  slots[slot] = null;
  writeStorySlots(slots);
}
