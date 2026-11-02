/**
 * Memory fragments. A downed player leaves one shard behind; whoever picks it up
 * gains one permanent stack for the rest of the run.
 *
 * This is a PvE progression rule, not a powerup: stacks never expire, they survive
 * a respawn inside the same world, and they are carried between campaign levels by
 * `main.ts`. Shards themselves never time out: one waits until it is picked up, until
 * a total wipe clears the floor, or until a level clear saves it into the slot.
 * Straight versus matches never drop a shard.
 */
export const MEMORY = {
  /** Three fallen players can feed one survivor; a fourth is wasted. */
  maxStacks: 3,
  /** Each stack adds one health segment, one fifth of walking speed and a quarter damage. */
  hpPerStack: 1,
  speedPerStack: 0.2,
  damagePerStack: 0.25,
  magnetRadius: 150,
  magnetSpeed: 280,
  pickupRadius: 34,
  color: '#8ef0ff',
  core: '#ffffff',
} as const;
