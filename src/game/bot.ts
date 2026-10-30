import { BOLT, BUG, FISHER, PLAYER, WEDGE, type Rect } from './config';
import { PROGRAM_ID } from './programs';
import { arenaSolids, type ArenaDef } from './arenas';
import { circleRect, hitScratch } from './collision';
import { Rng } from './rng';
import { arenaNav, NAV_MAX_PATH } from './nav';
import { ACTION, type InputFrame, type Player } from './types';
import type { World } from './world';

export const BOT_TIERS = ['rookie', 'veteran', 'digital', 'impossible'] as const;
export type BotTier = (typeof BOT_TIERS)[number];
export const BOT_TIER_LABELS: Record<BotTier, string> = {
  rookie: 'EASY',
  veteran: 'MEDIUM',
  digital: 'HARD',
  impossible: 'IMPOSSIBLE',
};
export const BOT_NAMES = ['VEX', 'GLITCH', 'RIFT'] as const;
export const BOT_STYLE_LABELS = ['DUELIST', 'TRICKSTER', 'SIEGE'] as const;

interface BotTuning {
  reaction: number;
  aimError: number;
  lead: number;
  fireMin: number;
  fireMax: number;
  candleMin: number;
  candleMax: number;
  dodge: number;
}

const TUNING: Record<BotTier, BotTuning> = {
  rookie: {
    reaction: 0.3,
    aimError: 0.2,
    lead: 0.45,
    fireMin: 1.05,
    fireMax: 1.8,
    candleMin: 5.5,
    candleMax: 8.5,
    dodge: 0.3,
  },
  veteran: {
    reaction: 0.16,
    aimError: 0.1,
    lead: 0.75,
    fireMin: 0.7,
    fireMax: 1.15,
    candleMin: 3.8,
    candleMax: 5.8,
    dodge: 0.68,
  },
  digital: {
    reaction: 0.055,
    aimError: 0.035,
    lead: 1,
    fireMin: 0.4,
    fireMax: 0.68,
    candleMin: 2.8,
    candleMax: 4.4,
    dodge: 0.94,
  },
  // Placeholder top difficulty. It is selectable so the ceiling can be felt and tuned;
  // the values are deliberately beyond HARD and can move without a UI change.
  impossible: {
    reaction: 0.02,
    aimError: 0,
    lead: 1,
    fireMin: 0.26,
    fireMax: 0.42,
    candleMin: 1.8,
    candleMax: 2.6,
    dodge: 1,
  },
};

interface BotStyle {
  range: number;
  strafe: number;
  fireScale: number;
  candleBias: number;
  dashBias: number;
}

const STYLES: readonly BotStyle[] = [
  { range: 170, strafe: 0.38, fireScale: 1, candleBias: 1.25, dashBias: 0.75 },
  { range: 245, strafe: 0.95, fireScale: 0.95, candleBias: 1, dashBias: 1.1 },
  { range: 355, strafe: 0.32, fireScale: 0.82, candleBias: 0.62, dashBias: 0.5 },
];

/**
 * A local digital opponent. It produces the same InputFrame a human does, so it is bound
 * by single-stick facing, swing locks, dash cooldowns and energy costs. It has no direct
 * access to world mutation: reaction error and imperfect lead keep the tiers honest.
 */
export class BotBrain {
  readonly slot: number;
  readonly tier: BotTier;
  readonly style: number;
  /** QA telemetry: how many heavy attacks this brain has committed to. */
  heavyCount = 0;

  private readonly tune: BotTuning;
  private readonly rule: BotStyle;
  private readonly rng: Rng;

  private target = -1;
  private targetTimer = 0;
  private fireCd = 0;
  private candleCd = 0;
  private heavyCd = 0;
  private heavyHold = 0;
  private swingCd = 0;
  private scanT = 0;
  private reactT = 0;
  private thrust = 0;
  private strafeDir = 1;

  private threatSerial = -1;
  private threatOwn = false;
  private threatType = 0;
  private threatX = 0;
  private threatY = 0;
  private threatVx = 0;
  private threatVy = 0;
  private threatTime = 0;
  private threatDist = 0;
  private detourX = 0;
  private detourY = 0;
  private readonly pathX = new Float32Array(NAV_MAX_PATH);
  private readonly pathY = new Float32Array(NAV_MAX_PATH);
  private pathCount = 0;
  private pathIndex = 0;
  private pathTimer = 0;
  private pathGoalX = 0;
  private pathGoalY = 0;

  constructor(slot: number, tier: BotTier, style: number, seed = 0x51f15e) {
    this.slot = slot;
    this.tier = tier;
    this.style = style % STYLES.length;
    this.tune = TUNING[tier];
    this.rule = STYLES[this.style];
    this.rng = new Rng(seed + slot * 0x9e37);
    this.strafeDir = slot % 2 === 0 ? 1 : -1;
    this.fireCd = this.rng.range(0.5, 1.4);
    this.candleCd = this.rng.range(2.5, 5);
    this.heavyCd = this.rng.range(6, 11);
  }

  reset(): void {
    this.target = -1;
    this.targetTimer = 0;
    this.fireCd = this.rng.range(0.4, 1.1);
    this.candleCd = this.rng.range(2.5, 5);
    this.heavyCd = this.rng.range(6, 11);
    this.heavyHold = 0;
    this.heavyCount = 0;
    this.swingCd = 0;
    this.scanT = 0;
    this.reactT = 0;
    this.thrust = 0;
    this.threatSerial = -1;
    this.pathCount = 0;
    this.pathIndex = 0;
    this.pathTimer = 0;
  }

  think(world: World, out: InputFrame, dt: number): void {
    out.mx = 0;
    out.my = 0;
    out.held = 0;
    out.pressed = 0;

    const me = world.players[this.slot];
    if (!me || !me.active || !me.alive) return;
    if (world.phase !== 'live' && world.phase !== 'practice') return;

    this.thrust += dt;
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.candleCd = Math.max(0, this.candleCd - dt);
    this.heavyCd = Math.max(0, this.heavyCd - dt);
    this.swingCd = Math.max(0, this.swingCd - dt);
    this.targetTimer -= dt;
    this.reactT = Math.max(0, this.reactT - dt);
    this.pathTimer = Math.max(0, this.pathTimer - dt);
    this.scanT -= dt;

    if (this.scanT <= 0) {
      this.scanT = 0.035;
      this.scanThreat(world, me);
    }

    if (this.target < 0 || this.targetTimer <= 0 || !this.targetAlive(world)) {
      this.pickTarget(world, me);
    }

    // Bots must not fight while pinned to a wall: a point-blank ricochet has no
    // reaction time. Pull back toward the center lane first.
    if (this.nearWall(me, world.arena)) {
      let tx = (world.arena.bounds.left + world.arena.bounds.right) * 0.5;
      let ty = (world.arena.bounds.top + world.arena.bounds.bottom) * 0.5;
      // A multi-deck arena's literal centre can be the trench. The bridge is the
      // safe lane to pull back to instead.
      const bridge = world.arena.traverse?.bridges[0];
      if (bridge) {
        tx = bridge.x + bridge.w * 0.5;
        ty = bridge.y + bridge.h * 0.5;
      }
      const cx = tx - me.x;
      const cy = ty - me.y;
      const cm = Math.hypot(cx, cy) || 1;
      out.mx = cx / cm;
      out.my = cy / cm;
      return;
    }

    // Reflex layer: deflect the closest bolt, or dash out of its line.
    if (this.threatSerial >= 0 && this.reactT <= 0) {
      if (this.handleThreat(me, out)) return;
    }

    const target = this.target >= 0 ? world.players[this.target] : null;
    if (!target || !target.active || !target.alive) return;

    // Fisher's beacon is a decoy for bots too: inside its radius it becomes the
    // focus, so a bot walks to it and shoots it while the Fisher repositions. A
    // player already in the bot's face still outranks the beacon.
    let fx = target.x;
    let fy = target.y;
    let fvx = target.vx;
    let fvy = target.vy;
    const lureIndex = world.nearestLureIndex(me.x, me.y, this.slot);
    if (lureIndex >= 0) {
      const lure = world.lures[lureIndex];
      const playerDist = Math.hypot(target.x - me.x, target.y - me.y);
      if (playerDist > PLAYER.radius * 4) {
        fx = lure.x;
        fy = lure.y;
        fvx = 0;
        fvy = 0;
      }
    }

    const dx = fx - me.x;
    const dy = fy - me.y;
    const dist = Math.hypot(dx, dy) || 1;
    const aim = this.computeAim(me, fx, fy, fvx, fvy, dist);
    const blocked = this.lineBlocked(me, fx, fy, world.arena.pillars);
    // Shots cross a floor gap, bodies do not. The route has to use the bridge even
    // when the bot has a clean firing line straight at the target.
    const gapBlocked = this.gapBlocked(me, fx, fy, world.arena);

    // Heavy attack: commit to a held power button now and then. The program owns what
    // that does (beam, plow or web), so the bot only has to hold, aim and release.
    if (this.heavyHold > 0) {
      this.heavyHold -= dt;
      out.mx = Math.cos(aim) * 0.5;
      out.my = Math.sin(aim) * 0.5;
      out.held |= ACTION.CANDLE;
      return;
    }
    if (
      this.heavyCd <= 0 &&
      !blocked &&
      me.laserCd <= 0 &&
      me.laserT <= 0 &&
      me.wedgeT <= 0 &&
      me.waveT <= 0 &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      me.energy >= 50 &&
      dist > 110 &&
      dist < 440 &&
      this.rng.next() < 0.006
    ) {
      out.mx = Math.cos(aim) * 0.5;
      out.my = Math.sin(aim) * 0.5;
      out.pressed |= ACTION.CANDLE;
      out.held |= ACTION.CANDLE;
      this.heavyCount++;
      this.heavyHold = me.program === PROGRAM_ID.FISHER ? 2.6 : 1.4;
      this.heavyCd = this.rng.range(11, 17);
      return;
    }

    // Fisher's beacon is a deliberate disengage: put it at his feet, then step
    // away so the pursuer has to choose between the player and the decoy. The
    // old opportunistic cast fired at close range while he was still aiming in.
    if (
      me.program === PROGRAM_ID.FISHER &&
      this.candleCd <= 0 &&
      me.bugCd <= 0 &&
      me.energy >= BUG.cost &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      me.laserT <= 0 &&
      !me.laserChargeHeld &&
      me.wedgeT <= 0 &&
      !blocked &&
      dist > 160 &&
      dist < FISHER.lureRadius - 20
    ) {
      out.mx = -dx / dist;
      out.my = -dy / dist;
      out.pressed |= ACTION.CANDLE;
      this.candleCd = this.rng.range(8, 10);
      return;
    }

    // Sweep clears the lane in front of him: split the brooms when the target is
    // close, then walk into the gap they leave. A tap, not a hold, so this is the
    // skill and never the giant sweep.
    if (
      me.program === PROGRAM_ID.SWEEP &&
      this.candleCd <= 0 &&
      me.bugCd <= 0 &&
      me.energy >= BUG.cost &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      me.laserT <= 0 &&
      !me.laserChargeHeld &&
      me.broT <= 0 &&
      !blocked &&
      dist > 50 &&
      dist < 210
    ) {
      out.mx = Math.cos(aim) * 0.8;
      out.my = Math.sin(aim) * 0.8;
      out.pressed |= ACTION.CANDLE;
      this.candleCd = this.rng.range(4.5, 6.5);
      return;
    }

    // The shot direction is the movement direction. Stepping into the aim is the
    // single-stick cost every player pays. Bot-owned bolts travel slower than a
    // human's, so range and lead must use the speed this brain actually fires.
    const boltSpeed = BOLT.speed * BOLT.enemySpeedMult;
    const boltRange = boltSpeed * BOLT.ttl;
    // Keep every style inside the distance its slowed bolt can actually reach.
    // The siege style used to hold at 355 while its bolt died at ~310.
    // Wedge wants to be closer for the bracket and plow; Fisher's spear reaches farther.
    const rangeScale = me.program === PROGRAM_ID.WEDGE ? 0.72 : me.program === PROGRAM_ID.FISHER ? 1.12 : 1;
    const engageRange = Math.min(this.rule.range * rangeScale, boltRange - 24);
    if (
      !blocked &&
      this.fireCd <= 0 &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      me.burstCd <= 0 &&
      me.burstLeft > 0 &&
      me.energy >= BOLT.cost &&
      dist < boltRange
    ) {
      out.mx = Math.cos(aim) * 0.82;
      out.my = Math.sin(aim) * 0.82;
      out.pressed |= ACTION.BOLT;
      this.fireCd = this.rng.range(this.tune.fireMin, this.tune.fireMax) / this.rule.fireScale;
      return;
    }

    // Wedge closes a lane when he reloads or is nearly dead: turn away from the
    // target and plant the bracket between them, then leave through it. A wall
    // planted while facing the target would sit behind him and do nothing.
    if (
      me.program === PROGRAM_ID.WEDGE &&
      this.candleCd <= 0 &&
      me.bugCd <= 0 &&
      me.energy >= BUG.cost &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      me.laserT <= 0 &&
      !me.laserChargeHeld &&
      me.wedgeT <= 0 &&
      !blocked &&
      dist > 110 &&
      dist < 280 &&
      (me.hp <= 1 || me.burstCd > 0.1)
    ) {
      out.mx = -dx / dist;
      out.my = -dy / dist;
      out.pressed |= ACTION.CANDLE;
      this.candleCd = this.rng.range(4.5, 6.5);
      return;
    }

    // Probe still uses its opportunistic mine cast. Wedge and Fisher have their
    // own deliberate skill branches above and should not roll a random tap.
    if (
      me.program === PROGRAM_ID.PROBE &&
      !blocked &&
      this.candleCd <= 0 &&
      me.bugCd <= 0 &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      me.energy >= BUG.cost &&
      dist > 40 &&
      dist < 175 &&
      this.rng.next() < this.rule.candleBias * 0.75
    ) {
      out.mx = Math.cos(aim) * 0.72;
      out.my = Math.sin(aim) * 0.72;
      out.pressed |= ACTION.CANDLE;
      this.candleCd = this.rng.range(this.tune.candleMin, this.tune.candleMax);
      return;
    }

    // Spacing: duelists close, tricksters orbit, siege units hold the far lane.
    let moveX = 0;
    let moveY = 0;
    if (blocked || gapBlocked) {
      // Walk around cover with a grid route. Corner-only steering can pinch
      // bots between two blocks; the route handles concave layouts.
      if (this.followPath(me, fx, fy, world.arena)) {
        moveX = this.detourX;
        moveY = this.detourY;
      } else {
        moveX = (-dy / dist) * this.strafeDir;
        moveY = (dx / dist) * this.strafeDir;
      }
    } else if (dist > engageRange + 34) {
      moveX = dx / dist;
      moveY = dy / dist;
    } else if (dist < engageRange - 48) {
      moveX = -dx / dist;
      moveY = -dy / dist;
    } else {
      moveX = (-dy / dist) * this.strafeDir;
      moveY = (dx / dist) * this.strafeDir;
      const correction = (dist - engageRange) * 0.01;
      moveX += (dx / dist) * correction;
      moveY += (dy / dist) * correction;
    }

    // Occasional committed dash: close a long gap, or reset spacing after a whiff.
    if (
      !blocked &&
      me.dashCharges > 0 &&
      me.swingPhase === 0 &&
      this.threatSerial < 0 &&
      dist > 330 &&
      this.rng.next() < 0.004 * this.rule.dashBias
    ) {
      out.mx = dx / dist;
      out.my = dy / dist;
      out.pressed |= ACTION.DASH;
      return;
    }

    this.applySeparation(world, me, moveX, moveY);
    this.avoidFurniture(me, moveX, moveY, world.arena);
    const mag = Math.hypot(this.steerX, this.steerY);
    if (mag > 0.001) {
      const speed = mag > 1 ? 1 / mag : 0.82 + Math.min(0.18, this.rule.strafe * 0.1);
      out.mx = this.steerX * speed;
      out.my = this.steerY * speed;
    }
  }

  private steerX = 0;
  private steerY = 0;

  private nearWall(me: Player, arena: ArenaDef): boolean {
    // Only the outer ring counts. A bot beside interior cover must navigate, not
    // abandon the chase and shove itself into that cover on the way to center.
    const safe = 64;
    const b = arena.bounds;
    return me.x < b.left + safe || me.x > b.right - safe || me.y < b.top + safe || me.y > b.bottom - safe;
  }

  private targetAlive(world: World): boolean {
    if (this.target < 0 || this.target >= world.players.length) return false;
    const p = world.players[this.target];
    return p.active && p.alive;
  }

  private pickTarget(world: World, me: Player): void {
    let best = -1;
    let bestScore = 1e12;
    for (let i = 0; i < world.players.length; i++) {
      if (i === this.slot) continue;
      const p = world.players[i];
      if (!p.active || !p.alive) continue;
      const dx = p.x - me.x;
      const dy = p.y - me.y;
      let score = dx * dx + dy * dy;
      if (p.hp <= 1) score -= 90000;
      if (p.score >= 2) score -= 50000;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    this.target = best;
    this.targetTimer = this.rng.range(0.55, 1.05);
  }

  private scanThreat(world: World, me: Player): void {
    let bestTime = 1;
    let serial = -1;
    let own = false;
    let type = 0;
    let px = 0;
    let py = 0;
    let pvx = 0;
    let pvy = 0;
    let pdist = 0;

    for (let i = 0; i < world.projectiles.length; i++) {
      const proj = world.projectiles[i];
      if (!proj.active) continue;
      // Own bolts become dangerous only after a bounce. Own candles are always a
      // blast risk, so both enter the threat scan.
      if (proj.owner === this.slot && (proj.type !== 0 || !proj.armed)) continue;
      const rx = proj.x - me.x;
      const ry = proj.y - me.y;
      const d2 = rx * rx + ry * ry;
      if (d2 > 340 * 340) continue;
      const speedSq = proj.vx * proj.vx + proj.vy * proj.vy;
      if (speedSq < 1) continue;
      const t = -(rx * proj.vx + ry * proj.vy) / speedSq;
      if (t <= 0.02 || t > 0.58) continue;
      const cx = rx + proj.vx * t;
      const cy = ry + proj.vy * t;
      const hitR = PLAYER.radius + proj.radius + 8;
      if (cx * cx + cy * cy > hitR * hitR) continue;
      if (t < bestTime) {
        bestTime = t;
        serial = proj.serial;
        own = proj.owner === this.slot;
        type = proj.type;
        px = proj.x;
        py = proj.y;
        pvx = proj.vx;
        pvy = proj.vy;
        pdist = Math.sqrt(d2);
      }
    }

    if (serial !== this.threatSerial) {
      if (serial >= 0 && this.threatSerial < 0) this.reactT = this.tune.reaction;
      this.threatSerial = serial;
    }
    if (serial < 0) this.reactT = 0;
    this.threatOwn = own;
    this.threatType = type;
    this.threatX = px;
    this.threatY = py;
    this.threatVx = pvx;
    this.threatVy = pvy;
    this.threatTime = bestTime;
    this.threatDist = pdist;
  }

  private handleThreat(me: Player, out: InputFrame): boolean {
    if (this.threatSerial < 0) return false;
    const dx = this.threatX - me.x;
    const dy = this.threatY - me.y;
    const dist = Math.hypot(dx, dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;

    // Wedge answers a long bolt with the bracket instead of a swat. Moving away
    // from the threat points his back at it; the wall lands between the two.
    if (
      me.program === PROGRAM_ID.WEDGE &&
      this.candleCd <= 0 &&
      me.bugCd <= 0 &&
      me.energy >= BUG.cost &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      me.laserT <= 0 &&
      !me.laserChargeHeld &&
      me.wedgeT <= 0 &&
      this.threatDist > WEDGE.wallOffset + PLAYER.radius + 8 &&
      this.threatDist < 340 &&
      this.threatTime > 0.08 &&
      this.threatTime < 0.55
    ) {
      out.mx = -dirX;
      out.my = -dirY;
      out.pressed |= ACTION.CANDLE;
      this.candleCd = this.rng.range(4.5, 6.5);
      return true;
    }

    // Candles are never safe to swat at close range. Own bolts are a ricochet
    // problem, so evade rather than trying to re-deflect a bad shot.
    if (!this.threatOwn && this.threatType === 0 && dist < PLAYER.swingReach + 14 && me.swingPhase === 0 && this.swingCd <= 0) {
      out.mx = dirX;
      out.my = dirY;
      out.pressed |= ACTION.SWING;
      this.swingCd = 0.38;
      return true;
    }

    if (
      me.dashCharges > 0 &&
      me.swingPhase === 0 &&
      this.threatTime < 0.3 &&
      this.threatDist < 190 &&
      this.rng.next() < this.tune.dodge
    ) {
      const vx = this.threatVx;
      const vy = this.threatVy;
      const vm = Math.hypot(vx, vy) || 1;
      const side = (this.strafeDir >= 0 ? 1 : -1) * (this.rng.next() < 0.5 ? -1 : 1);
      out.mx = (-vy / vm) * side;
      out.my = (vx / vm) * side;
      out.pressed |= ACTION.DASH;
      this.strafeDir = -this.strafeDir;
      return true;
    }

    // Slide off the line even without a dash. The old rule waited until the bolt
    // was almost touching, which made bots eat their own returning ricochets.
    const vx = this.threatVx;
    const vy = this.threatVy;
    const vm = Math.hypot(vx, vy) || 1;
    out.mx = (-vy / vm) * this.strafeDir - dirX * 0.35;
    out.my = (vx / vm) * this.strafeDir - dirY * 0.35;
    return true;
  }

  private lineBlocked(me: Player, tx: number, ty: number, pillars: readonly Rect[]): boolean {
    return this.firstBlocking(me.x, me.y, tx, ty, pillars, 10) >= 0;
  }

  /** True when the straight walk to the target would hit a floor gap. */
  private gapBlocked(me: Player, tx: number, ty: number, arena: ArenaDef): boolean {
    const gaps = arena.traverse?.chasms;
    if (!gaps) return false;
    return this.firstBlocking(me.x, me.y, tx, ty, gaps, PLAYER.radius + 2) >= 0;
  }

  /** Returns the index of the first solid crossed by a padded line, or -1. */
  private firstBlocking(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    solids: readonly Rect[],
    pad: number,
  ): number {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.min(48, Math.max(4, Math.ceil(dist / 18)));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = x0 + dx * t;
      const y = y0 + dy * t;
      for (let i = 0; i < solids.length; i++) {
        const r = solids[i];
        if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) {
          return i;
        }
      }
    }
    return -1;
  }

  /**
   * Follows the cached A* route to the target. Re-plans on a timer, on target
   * movement, or when the route runs out. The next 10 waypoints are checked for
   * line of sight so the bot cuts corners without clipping cover.
   */
  private followPath(me: Player, tx: number, ty: number, arena: ArenaDef): boolean {
    if (
      this.pathTimer <= 0 ||
      this.pathIndex >= this.pathCount ||
      Math.abs(tx - this.pathGoalX) > 64 ||
      Math.abs(ty - this.pathGoalY) > 64
    ) {
      this.pathCount = arenaNav(arena).findPath(me.x, me.y, tx, ty, this.pathX, this.pathY);
      this.pathIndex = 0;
      this.pathTimer = 0.55;
      this.pathGoalX = tx;
      this.pathGoalY = ty;
    }
    if (this.pathCount === 0) return false;

    while (this.pathIndex < this.pathCount - 1) {
      const wx = this.pathX[this.pathIndex] - me.x;
      const wy = this.pathY[this.pathIndex] - me.y;
      if (wx * wx + wy * wy < 22 * 22) this.pathIndex++;
      else break;
    }

    let chosen = this.pathIndex;
    const last = Math.min(this.pathCount - 1, this.pathIndex + 10);
    const solids = arenaSolids(arena);
    for (let i = last; i >= this.pathIndex; i--) {
      if (this.firstBlocking(me.x, me.y, this.pathX[i], this.pathY[i], solids, 12) < 0) {
        chosen = i;
        break;
      }
    }

    const dx = this.pathX[chosen] - me.x;
    const dy = this.pathY[chosen] - me.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 2) {
      this.pathIndex++;
      return false;
    }
    this.detourX = dx / d;
    this.detourY = dy / d;
    return true;
  }

  private computeAim(
    me: Player,
    tx: number,
    ty: number,
    tvx: number,
    tvy: number,
    dist: number,
  ): number {
    // Match the lead to the bot's actual bolt speed. Using the human BOLT.speed
    // here made every slowed bot shot trail a moving target.
    const boltSpeed = BOLT.speed * BOLT.enemySpeedMult;
    const lead = Math.min(0.45, dist / boltSpeed) * this.tune.lead;
    const px = tx + tvx * lead;
    const py = ty + tvy * lead;
    const base = Math.atan2(py - me.y, px - me.x);
    return base + Math.sin(this.thrust * 2.1 + this.slot * 1.7) * this.tune.aimError;
  }

  private applySeparation(world: World, me: Player, x: number, y: number): void {
    let sx = x;
    let sy = y;
    for (let i = 0; i < world.players.length; i++) {
      if (i === this.slot) continue;
      const p = world.players[i];
      if (!p.active || !p.alive) continue;
      const dx = me.x - p.x;
      const dy = me.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 58 * 58 || d2 < 1) continue;
      const d = Math.sqrt(d2);
      const push = (58 - d) / 58;
      sx += (dx / d) * push * 1.1;
      sy += (dy / d) * push * 1.1;
    }
    this.steerX = sx;
    this.steerY = sy;
  }

  private avoidFurniture(me: Player, x: number, y: number, arena: ArenaDef): void {
    let sx = this.steerX;
    let sy = this.steerY;
    const b = arena.bounds;

    const margin = PLAYER.radius + 44;
    if (me.x < b.left + margin) sx += (b.left + margin - me.x) / 90;
    if (me.x > b.right - margin) sx -= (me.x - (b.right - margin)) / 90;
    if (me.y < b.top + margin) sy += (b.top + margin - me.y) / 90;
    if (me.y > b.bottom - margin) sy -= (me.y - (b.bottom - margin)) / 90;

    const aheadX = me.x + sx * 54;
    const aheadY = me.y + sy * 54;
    const solids = arenaSolids(arena);
    for (let i = 0; i < solids.length; i++) {
      if (!circleRect(aheadX, aheadY, 20, solids[i], hitScratch)) continue;
      sx += hitScratch.nx * 1.4;
      sy += hitScratch.ny * 1.4;
      break;
    }
    this.steerX = sx;
    this.steerY = sy;
  }
}
