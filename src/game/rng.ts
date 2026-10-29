/** Small deterministic xorshift32 RNG. Used for repeatable benches and cosmetic variation. */
export class Rng {
  private state: number;

  constructor(seed = 0x9e3779b9) {
    this.state = seed >>> 0 || 1;
  }

  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, maxExclusive: number): number {
    return Math.floor(this.range(min, maxExclusive));
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length) % items.length];
  }
}
