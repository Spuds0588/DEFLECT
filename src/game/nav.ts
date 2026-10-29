import { PLAYER, type Bounds } from './config';
import type { ArenaDef } from './arenas';

/**
 * Bots need to walk around concave cover, not just strafe at it. This is a small
 * 20-unit grid built once per arena, plus one reusable A* workspace. All buffers
 * are preallocated: pathfinding runs inside the host's simulation loop.
 */
const CELL = 20;
const CLEARANCE = PLAYER.radius + 1;
const SQRT2 = Math.SQRT2;

/** Max waypoints a bot stores from one query. */
export const NAV_MAX_PATH = 240;

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];

export class ArenaNav {
  private readonly cols: number;
  private readonly rows: number;
  private readonly cells: number;
  private readonly heapCapacity: number;
  private readonly bounds: Bounds;
  private readonly blocked: Uint8Array;
  private readonly gScore: Float32Array;
  private readonly fScore: Float32Array;
  private readonly cameFrom: Int32Array;
  private readonly visit: Uint16Array;
  private readonly closed: Uint16Array;
  private readonly heap: Int32Array;
  private readonly cellPath: Int32Array;
  private heapSize = 0;
  private generation = 0;

  constructor(arena: ArenaDef) {
    this.bounds = arena.bounds;
    this.cols = Math.max(1, Math.floor((this.bounds.right - this.bounds.left) / CELL));
    this.rows = Math.max(1, Math.floor((this.bounds.bottom - this.bounds.top) / CELL));
    this.cells = this.cols * this.rows;
    this.heapCapacity = this.cells * 8;

    this.blocked = new Uint8Array(this.cells);
    this.gScore = new Float32Array(this.cells);
    this.fScore = new Float32Array(this.cells);
    this.cameFrom = new Int32Array(this.cells);
    this.visit = new Uint16Array(this.cells);
    this.closed = new Uint16Array(this.cells);
    this.heap = new Int32Array(this.heapCapacity);
    this.cellPath = new Int32Array(this.cells);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = this.bounds.left + c * CELL + CELL * 0.5;
        const y = this.bounds.top + r * CELL + CELL * 0.5;
        let blocked = 0;
        for (let i = 0; i < arena.pillars.length; i++) {
          const p = arena.pillars[i];
          // Conservative expanded box: no path cell can touch cover.
          if (
            x > p.x - CLEARANCE &&
            x < p.x + p.w + CLEARANCE &&
            y > p.y - CLEARANCE &&
            y < p.y + p.h + CLEARANCE
          ) {
            blocked = 1;
            break;
          }
        }
        this.blocked[r * this.cols + c] = blocked;
      }
    }
  }

  private cellCenterX(index: number): number {
    return this.bounds.left + (index % this.cols) * CELL + CELL * 0.5;
  }

  private cellCenterY(index: number): number {
    return this.bounds.top + Math.floor(index / this.cols) * CELL + CELL * 0.5;
  }

  private cellOf(x: number, y: number): number {
    const c = Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.bounds.left) / CELL)));
    const r = Math.max(0, Math.min(this.rows - 1, Math.floor((y - this.bounds.top) / CELL)));
    return r * this.cols + c;
  }

  private nearestFree(x: number, y: number): number {
    const c0 = Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.bounds.left) / CELL)));
    const r0 = Math.max(0, Math.min(this.rows - 1, Math.floor((y - this.bounds.top) / CELL)));
    if (this.blocked[r0 * this.cols + c0] === 0) return r0 * this.cols + c0;
    for (let radius = 1; radius <= 8; radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
          const r = r0 + dr;
          const c = c0 + dc;
          if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) continue;
          const index = r * this.cols + c;
          if (this.blocked[index] === 0) return index;
        }
      }
    }
    return -1;
  }

  private octile(a: number, b: number): number {
    const ax = a % this.cols;
    const ay = Math.floor(a / this.cols);
    const bx = b % this.cols;
    const by = Math.floor(b / this.cols);
    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    const min = dx < dy ? dx : dy;
    return dx + dy + (SQRT2 - 2) * min;
  }

  private heapPush(index: number): void {
    if (this.heapSize >= this.heapCapacity) return;
    let i = this.heapSize++;
    const f = this.fScore[index];
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const p = this.heap[parent];
      if (this.fScore[p] <= f) break;
      this.heap[i] = p;
      i = parent;
    }
    this.heap[i] = index;
  }

  private heapPop(): number {
    const top = this.heap[0];
    const last = this.heap[--this.heapSize];
    let i = 0;
    while (true) {
      let child = i * 2 + 1;
      if (child >= this.heapSize) break;
      if (child + 1 < this.heapSize && this.fScore[this.heap[child + 1]] < this.fScore[this.heap[child]]) {
        child++;
      }
      if (this.fScore[this.heap[child]] >= this.fScore[last]) break;
      this.heap[i] = this.heap[child];
      i = child;
    }
    this.heap[i] = last;
    return top;
  }

  /**
   * Writes up to NAV_MAX_PATH waypoint centers into `outX/outY`, in walk order.
   * Returns 0 when no route exists. No allocation after construction.
   */
  findPath(
    startX: number,
    startY: number,
    goalX: number,
    goalY: number,
    outX: Float32Array,
    outY: Float32Array,
  ): number {
    const start = this.nearestFree(startX, startY);
    const goal = this.nearestFree(goalX, goalY);
    if (start < 0 || goal < 0 || start === goal) return 0;

    this.generation++;
    if (this.generation > 60000) {
      this.visit.fill(0);
      this.closed.fill(0);
      this.generation = 1;
    }
    const gen = this.generation;

    this.heapSize = 0;
    this.gScore[start] = 0;
    this.cameFrom[start] = -1;
    this.visit[start] = gen;
    this.fScore[start] = this.octile(start, goal);
    this.heapPush(start);

    let found = false;
    while (this.heapSize > 0) {
      const current = this.heapPop();
      if (this.closed[current] === gen) continue;
      this.closed[current] = gen;
      if (current === goal) {
        found = true;
        break;
      }
      const cx = current % this.cols;
      const cy = Math.floor(current / this.cols);
      for (let d = 0; d < 8; d++) {
        const nx = cx + DX[d];
        const ny = cy + DY[d];
        if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) continue;
        const next = ny * this.cols + nx;
        if (this.blocked[next] !== 0 || this.closed[next] === gen) continue;
        if (d >= 4 && (this.blocked[cy * this.cols + nx] !== 0 || this.blocked[ny * this.cols + cx] !== 0)) {
          continue;
        }
        const cost = d >= 4 ? SQRT2 : 1;
        const tentative = this.gScore[current] + cost;
        if (this.visit[next] === gen && tentative >= this.gScore[next]) continue;
        this.visit[next] = gen;
        this.gScore[next] = tentative;
        this.cameFrom[next] = current;
        this.fScore[next] = tentative + this.octile(next, goal);
        this.heapPush(next);
      }
    }

    if (!found) return 0;

    let count = 0;
    let node = goal;
    while (node >= 0 && count < this.cells) {
      this.cellPath[count++] = node;
      node = this.cameFrom[node];
    }

    // cellPath is goal → start. Emit start → goal, capped so a pathological
    // route cannot overrun the bot's array. The final goal cell is preserved.
    const take = count < NAV_MAX_PATH ? count : NAV_MAX_PATH;
    for (let i = 0; i < take; i++) {
      const index = this.cellPath[count - 1 - i];
      outX[i] = this.cellCenterX(index);
      outY[i] = this.cellCenterY(index);
    }
    if (take === NAV_MAX_PATH) {
      outX[take - 1] = this.cellCenterX(goal);
      outY[take - 1] = this.cellCenterY(goal);
    }
    return take;
  }
}

const CACHE: (ArenaNav | undefined)[] = [];

export function arenaNav(arena: ArenaDef): ArenaNav {
  let nav = CACHE[arena.id];
  if (!nav) {
    nav = new ArenaNav(arena);
    CACHE[arena.id] = nav;
  }
  return nav;
}
