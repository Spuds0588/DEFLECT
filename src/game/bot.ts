import { AIMBOT, ATOMIZE, BOLT, BUFFER, BUG, COMPRESS, COPYPASTA, EMITTER, FISHER, GHOST, KABOOM, PINBALL, PLAYER, SIM_DT, STORM_CLOUD, TOXIC, WEDGE, type Rect } from './config';
import { MINIBOSS } from './minibosses';
import { PROGRAM_ID } from './programs';
import { POWERUP_KIND } from './powerups';
import {
  arenaSolids,
  discCenterX,
  discCenterY,
  discHoleX,
  discHoleY,
  usbCenterX,
  usbCenterY,
  usbFloorAt,
  KEYPAD_STATE,
  type ArenaDef,
} from './arenas';
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
 * Shot types a guard or lash can send back. Mines (1), bug walls (2) and the two
 * bomber shells (8, 9) are excluded by the world's deflect branches; a threat that
 * cannot be returned must be dodged instead.
 */
function canDeflectShot(type: number): boolean {
  return type !== 1 && type !== 2 && type !== 8 && type !== 9;
}

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
  /** Orbit direction flips on a slow timer so long strafes do not look robotic. */
  private strafeT = 0;
  /** Frames of held guard after spotting an incoming bolt. */
  private guardHoldT = 0;
  /** Local pacing so the bot does not turtle behind the shield every shot. */
  private guardCd = 0;
  /** Remaining seconds of a held overcharge beam. */
  private beamHoldT = 0;
  /** Latched cover-avoid direction, so the probe cannot flip it every frame. */
  private avoidT = 0;
  private avoidDirX = 0;
  private avoidDirY = 0;
  /** Keep the route for a beat once cover blocks the straight line. */
  private routeHoldT = 0;

  /** Gauntlet pilot's sticking target, held by family + pool index. */
  private hostileKind = -1;
  private hostileIdx = -1;
  private hostileX = 0;
  private hostileY = 0;

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
    this.strafeT = this.rng.range(3.5, 6.5);
    this.guardHoldT = 0;
    this.guardCd = this.rng.range(0.5, 1.5);
    this.beamHoldT = 0;
    this.avoidT = 0;
    this.avoidDirX = 0;
    this.avoidDirY = 0;
    this.routeHoldT = 0;
    this.hostileKind = -1;
    this.hostileIdx = -1;
    this.threatSerial = -1;
    this.pathCount = 0;
    this.pathIndex = 0;
    this.pathTimer = 0;
  }

  think(world: World, out: InputFrame, dt: number): void {
    this.thinkCore(world, out, dt);
    const body = world.players[this.slot];
    if (!body || !body.active || !body.alive) return;
    if (world.phase !== 'live' && world.phase !== 'practice') return;
    this.objectiveFrame(world, body, out);
    this.floorSweep(world, body, out);
  }

  private thinkCore(world: World, out: InputFrame, dt: number): void {
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
    this.guardCd = Math.max(0, this.guardCd - dt);
    this.guardHoldT = Math.max(0, this.guardHoldT - dt);
    this.beamHoldT = Math.max(0, this.beamHoldT - dt);
    this.avoidT = Math.max(0, this.avoidT - dt);
    this.routeHoldT = Math.max(0, this.routeHoldT - dt);
    this.laneDashT = Math.max(0, this.laneDashT - dt);
    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      this.strafeT = this.rng.range(3.5, 7);
      this.strafeDir = -this.strafeDir;
    }
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
      this.bossFrame(world, me, out);
      return;
    }

    // A guard commitment spans several frames: keep the shield up and turn its face
    // toward the bolt instead of dropping back to the spacing logic.
    if (this.guardHoldT > 0) {
      out.held |= ACTION.SWING;
      if (this.threatSerial >= 0) {
        const gx = this.threatX - me.x;
        const gy = this.threatY - me.y;
        const gd = Math.hypot(gx, gy) || 1;
        out.mx = (gx / gd) * 0.45;
        out.my = (gy / gd) * 0.45;
      }
      this.bossFrame(world, me, out);
      return;
    }

    // Reflex layer: deflect the closest bolt, or dash out of its line.
    if (this.threatSerial >= 0 && this.reactT <= 0) {
      if (this.handleThreat(me, out, world.arena, world.usbT)) { this.bossFrame(world, me, out); return; }
    }

    const target = this.target >= 0 ? world.players[this.target] : null;
    if (!target || !target.active || !target.alive) {
      if (this.engageHostiles(world, me, out)) { this.bossFrame(world, me, out); return; }
      return;
    }

    // Fisher's beacon is a decoy for bots too: inside its radius it becomes the
    // focus, so a bot walks to it and shoots it while the Fisher repositions. A
    // player already in the bot's face still outranks the beacon.
    let fx = target.x;
    let fy = target.y;
    let fvx = target.vx;
    let fvy = target.vy;
    let lureFocus = false;
    const lureIndex = world.nearestLureIndex(me.x, me.y, this.slot);
    if (lureIndex >= 0) {
      const lure = world.lures[lureIndex];
      const playerDist = Math.hypot(target.x - me.x, target.y - me.y);
      if (playerDist > PLAYER.radius * 4) {
        fx = lure.x;
        fy = lure.y;
        fvx = 0;
        fvy = 0;
        lureFocus = true;
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

    // Jump-scare is armed: get into the burst and press melee. The cloak makes the
    // approach safe, so the bot does not have to stop and trade at range first.
    if (me.program === PROGRAM_ID.GHOST && me.scareT > 0) {
      if (dist < GHOST.scareRadius * 0.55 && me.swingPhase === 0 && me.dashT <= 0) {
        out.mx = dx / dist;
        out.my = dy / dist;
        out.pressed |= ACTION.SWING;
        return;
      }
      out.mx = (dx / dist) * (dist > 120 ? 0.95 : 0.55);
      out.my = (dy / dist) * (dist > 120 ? 0.95 : 0.55);
      return;
    }

    // Ghost spends the cloak when a shot is already in the air or after taking a real
    // hit. A tap, so it is the invisibility skill and never the jump-scare heavy.
    if (
      me.program === PROGRAM_ID.GHOST &&
      this.candleCd <= 0 &&
      me.bugCd <= 0 &&
      me.cloakT <= 0 &&
      me.scareT <= 0 &&
      me.energy >= BUG.cost &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      me.laserT <= 0 &&
      !me.laserChargeHeld &&
      (me.hp <= 1 || this.threatSerial >= 0 || dist < 170)
    ) {
      out.mx = Math.cos(aim) * 0.65;
      out.my = Math.sin(aim) * 0.65;
      out.pressed |= ACTION.CANDLE;
      this.candleCd = this.rng.range(6, 8);
      return;
    }

    // Ghost's jump-scare is a close burst, so arm it inside the band where the chase can
    // reach the target before the window closes. The armed branch above takes over melee.
    if (
      me.program === PROGRAM_ID.GHOST &&
      this.heavyCd <= 0 &&
      me.laserCd <= 0 &&
      me.scareT <= 0 &&
      me.energy >= GHOST.scareCost &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      !me.laserChargeHeld &&
      !blocked &&
      dist > 50 &&
      dist < 300
    ) {
      out.mx = Math.cos(aim) * 0.5;
      out.my = Math.sin(aim) * 0.5;
      out.pressed |= ACTION.CANDLE;
      out.held |= ACTION.CANDLE;
      this.heavyCount++;
      this.heavyHold = GHOST.scareChargeTime + 0.25;
      this.heavyCd = this.rng.range(10, 15);
      return;
    }

    // Compress's burst is centred on him, so hold the heavy when the target is already
    // inside the ring. Firing it at arm's length is the point; firing at a distant
    // target folds empty floor.
    if (
      me.program === PROGRAM_ID.COMPRESS &&
      this.heavyCd <= 0 &&
      me.laserCd <= 0 &&
      me.energy >= COMPRESS.powerCost &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      !me.laserChargeHeld &&
      !blocked &&
      dist > 30 &&
      dist < COMPRESS.powerRadius - 30
    ) {
      out.mx = Math.cos(aim) * 0.5;
      out.my = Math.sin(aim) * 0.5;
      out.pressed |= ACTION.CANDLE;
      out.held |= ACTION.CANDLE;
      this.heavyCount++;
      this.heavyHold = COMPRESS.powerChargeTime + 0.2;
      this.heavyCd = this.rng.range(10, 15);
      return;
    }

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

    // Kaboom's lob is a medium-range commitment: drop the heavy shell on the target
    // rather than at his own feet, where the blast would catch him too.
    if (
      me.program === PROGRAM_ID.KABOOM &&
      this.candleCd <= 0 &&
      me.bugCd <= 0 &&
      me.energy >= BUG.cost &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      me.laserT <= 0 &&
      !me.laserChargeHeld &&
      !blocked &&
      dist > 90 &&
      dist < KABOOM.lobRange + 60
    ) {
      out.mx = Math.cos(aim) * 0.55;
      out.my = Math.sin(aim) * 0.55;
      out.pressed |= ACTION.CANDLE;
      this.candleCd = this.rng.range(5, 7);
      return;
    }

    // Toxic's spray is a close-quarters burst: poison everything around him as a
    // target closes, then keep walking in. A tap, so it is the skill, never the cone.
    if (
      me.program === PROGRAM_ID.TOXIC &&
      this.candleCd <= 0 &&
      me.bugCd <= 0 &&
      me.energy >= BUG.cost &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      me.laserT <= 0 &&
      !me.laserChargeHeld &&
      me.toxT <= 0 &&
      !blocked &&
      dist > 30 &&
      dist < TOXIC.sprayRadius - 24
    ) {
      out.mx = Math.cos(aim) * 0.7;
      out.my = Math.sin(aim) * 0.7;
      out.pressed |= ACTION.CANDLE;
      this.candleCd = this.rng.range(4.5, 6.5);
      return;
    }

    // Atomize's shield balls are best spent on a closing target. Tap when the orbit
    // is empty; a second tap while any ball survives would be refused.
    if (
      me.program === PROGRAM_ID.ATOMIZE &&
      this.candleCd <= 0 &&
      me.bugCd <= 0 &&
      me.atomBalls === 0 &&
      me.energy >= BUG.cost &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      me.laserT <= 0 &&
      !me.laserChargeHeld &&
      me.orbitT <= 0 &&
      !blocked &&
      dist > 20 &&
      dist < ATOMIZE.ballOrbit + 100
    ) {
      out.mx = Math.cos(aim) * 0.8;
      out.my = Math.sin(aim) * 0.8;
      out.pressed |= ACTION.CANDLE;
      this.candleCd = this.rng.range(5, 7);
      return;
    }

    // Bad Lag's fast-forward is a window, not a projectile: spend it when a target is
    // in reach so the burn goes into closing distance and chaining shots. A tap, so
    // this is always the skill and never the dilation heavy.
    if (
      me.program === PROGRAM_ID.BUFFER &&
      this.candleCd <= 0 &&
      me.bugCd <= 0 &&
      me.energy >= BUG.cost &&
      me.fastT <= 0 &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      me.laserT <= 0 &&
      !me.laserChargeHeld &&
      !blocked &&
      dist > 40 &&
      dist < 320
    ) {
      out.mx = Math.cos(aim) * 0.9;
      out.my = Math.sin(aim) * 0.9;
      out.pressed |= ACTION.CANDLE;
      this.candleCd = this.rng.range(6, 8);
      return;
    }

    // Compress folds small to close a gap or to leave one. Tap it while the target is
    // still out of the spray range; the burst branch above handles the close fight.
    if (
      me.program === PROGRAM_ID.COMPRESS &&
      this.candleCd <= 0 &&
      me.bugCd <= 0 &&
      me.energy >= BUG.cost &&
      me.shrinkT <= 0 &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      me.laserT <= 0 &&
      !me.laserChargeHeld &&
      !blocked &&
      dist > 120 &&
      dist < 420
    ) {
      out.mx = Math.cos(aim) * 0.9;
      out.my = Math.sin(aim) * 0.9;
      out.pressed |= ACTION.CANDLE;
      this.candleCd = this.rng.range(7, 9);
      return;
    }

    // Pinball's flipper is planted in front of him when the target is in the lane the
    // paddle can sweep. It stays behind after he repositions, so the cast wants some
    // room ahead of the body, not a target already on top of him.
    if (
      me.program === PROGRAM_ID.PINBALL &&
      this.candleCd <= 0 &&
      me.bugCd <= 0 &&
      me.armT <= 0 &&
      me.energy >= BUG.cost &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      me.laserT <= 0 &&
      !me.laserChargeHeld &&
      !blocked &&
      dist > 90 &&
      dist < 360
    ) {
      out.mx = Math.cos(aim) * 0.55;
      out.my = Math.sin(aim) * 0.55;
      out.pressed |= ACTION.CANDLE;
      this.candleCd = this.rng.range(10, 14);
      return;
    }

    // Copy Pasta's summon is a second body, so spend it before the fight is already on
    // top of him: the copy needs a beat to walk onto its target.
    if (
      me.program === PROGRAM_ID.COPYPASTA &&
      this.candleCd <= 0 &&
      me.bugCd <= 0 &&
      me.energy >= BUG.cost &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      me.laserT <= 0 &&
      !me.laserChargeHeld &&
      !blocked &&
      dist > 120 &&
      dist < 380
    ) {
      out.mx = Math.cos(aim) * 0.6;
      out.my = Math.sin(aim) * 0.6;
      out.pressed |= ACTION.CANDLE;
      this.candleCd = this.rng.range(11, 15);
      return;
    }

    // The shot direction is the movement direction. Stepping into the aim is the
    // single-stick cost every player pays. Bot-owned bolts travel slower than a
    // human's, so range and lead must use the speed this brain actually fires.
    // Target lock holds facing on the target, so the bot can strafe at range and still
    // shoot. Without it every shot meant stepping straight at the target and every
    // spacing correction pulled it back, which read as back-and-forth jitter.
    if (!blocked && !lureFocus) out.held |= ACTION.LOCK;
    // Pinball's ball is slower but lives far longer than a bolt, so its engagement
    // band follows its own flight, not the generic bolt range.
    const boltSpeed = (me.program === PROGRAM_ID.PINBALL
      ? PINBALL.shotSpeed
      : me.program === PROGRAM_ID.COPYPASTA
        ? COPYPASTA.shotSpeed
        : me.program === PROGRAM_ID.AIMBOT
          ? AIMBOT.shotSpeed
          : me.program === PROGRAM_ID.BUFFER
            ? BUFFER.shotSpeed
            : BOLT.speed) * BOLT.enemySpeedMult;
    const boltRange = me.program === PROGRAM_ID.PINBALL
      ? boltSpeed * PINBALL.shotTtl
      : me.program === PROGRAM_ID.COPYPASTA
        ? boltSpeed * COPYPASTA.shotTtl
        : me.program === PROGRAM_ID.AIMBOT
          ? AIMBOT.volleyRange
          : me.program === PROGRAM_ID.BUFFER
            ? boltSpeed * BUFFER.shotTtl
            : boltSpeed * BOLT.ttl;
    // Keep every style inside the distance its slowed shot can actually reach.
    // The siege style used to hold at 355 while its bolt died at ~310.
    // Wedge wants to be closer for the bracket and plow; Fisher's spear reaches farther.
    const rangeScale =
      me.program === PROGRAM_ID.WEDGE
        ? 0.72
        : me.program === PROGRAM_ID.FISHER
          ? 1.12
          : me.program === PROGRAM_ID.PINBALL
            ? 1.35
            : me.program === PROGRAM_ID.AIMBOT
              ? 2.4
              : 1;
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
      out.pressed |= ACTION.BOLT;
      this.fireCd = this.rng.range(this.tune.fireMin, this.tune.fireMax) / this.rule.fireScale;
      // A locked shot already leaves along facing, so the body can keep strafing.
      // Unlocked shots still need the step into the aim, because the shot leaves along
      // the movement vector.
      if (!me.lockActive) {
        out.mx = Math.cos(aim) * 0.82;
        out.my = Math.sin(aim) * 0.82;
        return;
      }
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
    // The radial error is continuous, so holding a range means orbiting it. The old
    // hard thresholds made the bot pump straight in and out whenever it straddled
    // one, which read as twitchy back-and-forth jitter.
    let moveX = 0;
    let moveY = 0;
    // Once cover breaks the straight line, commit to the route for a beat. Cover LOS is
    // an instant test, so a body straddling the edge of a pillar's shadow flips the
    // branch every frame and shudders there instead of walking around.
    if (blocked || gapBlocked) this.routeHoldT = 0.5;
    if (this.routeHoldT > 0 && this.followPath(me, fx, fy, world.arena)) {
      // Walk around cover with a grid route. Corner-only steering can pinch
      // bots between two blocks; the route handles concave layouts.
      moveX = this.detourX;
      moveY = this.detourY;
    } else if (blocked || gapBlocked) {
      moveX = (-dy / dist) * this.strafeDir;
      moveY = (dx / dist) * this.strafeDir;
    } else {
      const radial = Math.max(-1, Math.min(1, (dist - engageRange) / 72));
      const orbit = (1 - Math.abs(radial)) * this.strafeDir;
      moveX = (dx / dist) * radial - (dy / dist) * orbit;
      moveY = (dy / dist) * radial + (dx / dist) * orbit;
    }

    // Occasional committed dash: close a long gap, or reset spacing after a whiff.
    if (
      !blocked &&
      me.dashCharges > 0 &&
      me.swingPhase === 0 &&
      this.threatSerial < 0 &&
      dist > 330 &&
      this.dashSafe(world.arena, me.x, me.y, dx / dist, dy / dist, world.usbT) &&
      this.rng.next() < 0.004 * this.rule.dashBias
    ) {
      out.mx = dx / dist;
      out.my = dy / dist;
      out.pressed |= ACTION.DASH;
      return;
    }

    this.applySeparation(world, me, moveX, moveY);
    this.avoidFurniture(me, moveX, moveY, world);
    const mag = Math.hypot(this.steerX, this.steerY);
    if (mag > 0.001) {
      const speed = mag > 1 ? 1 / mag : 0.82 + Math.min(0.18, this.rule.strafe * 0.1);
      out.mx = this.steerX * speed;
      out.my = this.steerY * speed;
    }
  }

  /**
   * QA-only gauntlet pilot. With no human opponent to fight, walk to the nearest
   * hostile and use the basic kit. This is what lets `?gauntlet=1&bot=1` exercise the
   * camera against live waves; it is not a PvE ally controller, and it never runs in a
   * match where a player target exists.
   */
  private engageHostiles(world: World, me: Player, out: InputFrame): boolean {
    if (world.mode !== 'gauntlet') return false;
    // At one segment the next pass ends the run. A RESTORE drop is drawn on the floor, so a
    // player breaks off for it; the pilot should too, instead of trading for a kill.
    if (this.fightBoss(world, me, out)) return true;

    // Low pool: take a drawn RESTORE before trading again. The boss branch has its own copy;
    // this covers the fodder and sentry phases, where the pilot used to trade the last segment.
    if (me.hp <= 2) {
      let gx = 0;
      let gy = 0;
      let gd = 1400;
      let found = false;
      for (let i = 0; i < world.pickups.length; i++) {
        const k = world.pickups[i];
        if (!k.active || k.kind !== POWERUP_KIND.RESTORE) continue;
        const d = Math.hypot(k.x - me.x, k.y - me.y);
        if (d < gd) {
          gd = d;
          gx = k.x;
          gy = k.y;
          found = true;
        }
      }
      if (found) {
        const dx = gx - me.x;
        const dy = gy - me.y;
        const d = Math.hypot(dx, dy) || 1;
        out.mx = dx / d;
        out.my = dy / d;
        out.held |= ACTION.LOCK;
        return true;
      }
    }

    const bossPass = world.worms.some(
      (w) => w.active && w.bossKind >= 0 && Math.hypot(w.vx, w.vy) > 300,
    );
    if (me.hp <= 1 || (me.hp <= 2 && bossPass)) {
      let bestD = 900;
      let gx = 0;
      let gy = 0;
      let found = false;
      for (let i = 0; i < world.pickups.length; i++) {
        const k = world.pickups[i];
        if (!k.active || k.kind !== POWERUP_KIND.RESTORE) continue;
        const d = Math.hypot(k.x - me.x, k.y - me.y);
        if (d < bestD) {
          bestD = d;
          gx = k.x;
          gy = k.y;
          found = true;
        }
      }
      if (found) {
        const dx = gx - me.x;
        const dy = gy - me.y;
        const d = Math.hypot(dx, dy) || 1;
        out.mx = dx / d;
        out.my = dy / d;
        return true;
      }
    }
    let tx = 0;
    let ty = 0;
    let best = Infinity;
    let found = false;
    let kind = -1;
    let idx = -1;
    const worms = world.worms;
    for (let i = 0; i < worms.length; i++) {
      const w = worms[i];
      if (!w.active) continue;
      const dx = w.x - me.x;
      const dy = w.y - me.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        tx = w.x;
        ty = w.y;
        kind = 0;
        idx = i;
        found = true;
      }
    }
    const viruses = world.viruses;
    for (let i = 0; i < viruses.length; i++) {
      const v = viruses[i];
      if (!v.active) continue;
      const dx = v.x - me.x;
      const dy = v.y - me.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        tx = v.x;
        ty = v.y;
        kind = 1;
        idx = i;
        found = true;
      }
    }
    const sentries = world.sentries;
    for (let i = 0; i < sentries.length; i++) {
      const s = sentries[i];
      if (!s.active) continue;
      // Calibration subjects are not enemies until the campaign wakes them. A bot
      // must not walk over and start shooting the Warden's dormant class.
      if (s.kind >= 4 && s.kind <= 6 && s.shapeState < 2) continue;
      const dx = s.x - me.x;
      const dy = s.y - me.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        tx = s.x;
        ty = s.y;
        kind = 2;
        idx = i;
        found = true;
      }
    }
    const errors = world.errors;
    for (let i = 0; i < errors.length; i++) {
      const e = errors[i];
      if (!e.active) continue;
      const dx = e.x - me.x;
      const dy = e.y - me.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        tx = e.x;
        ty = e.y;
        kind = 3;
        idx = i;
        found = true;
      }
    }

    // Hold the chosen hostile until another is clearly closer. Re-picking the nearest
    // body every tick flips the walk direction between two equidistant threats, which
    // is the other half of the pilot's stutter.
    if (this.hostileActive(world)) {
      const hx = this.hostileX - me.x;
      const hy = this.hostileY - me.y;
      const hd = hx * hx + hy * hy;
      if (!found || hd <= best * 0.72) {
        tx = this.hostileX;
        ty = this.hostileY;
        found = true;
      } else {
        this.hostileKind = kind;
        this.hostileIdx = idx;
      }
    } else if (found) {
      this.hostileKind = kind;
      this.hostileIdx = idx;
    }

    if (!found) {
      // Drift toward the middle between waves so the pilot does not park on a spawn
      // edge and wait for the next pack to walk into it.
      const cx = (world.arena.bounds.left + world.arena.bounds.right) * 0.5;
      const cy = (world.arena.bounds.top + world.arena.bounds.bottom) * 0.5;
      const dx = cx - me.x;
      const dy = cy - me.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 30) {
        let mx = (dx / d) * 0.55;
        let my = (dy / d) * 0.55;
        // The idle drift used to bypass avoidFurniture, so a hole or an emitter lane
        // could swallow the pilot before the first pack landed. Route its steering
        // through the same hazard layer as the chase.
        this.steerX = mx;
        this.steerY = my;
        this.avoidFurniture(me, mx, my, world);
        mx = this.steerX;
        my = this.steerY;
        const m = Math.hypot(mx, my);
        if (m > 1) {
          mx /= m;
          my /= m;
        }
        out.mx = mx;
        out.my = my;
      }
      return true;
    }

    const dx = tx - me.x;
    const dy = ty - me.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const aim = Math.atan2(dy, dx);
    const blocked = this.lineBlocked(me, tx, ty, world.arena.pillars);

    // Lock holds facing on the hostile, so the pilot can orbit and keep shooting
    // instead of stepping in to aim and backing out again. Cover still stops the shot.
    if (!blocked) out.held |= ACTION.LOCK;

    // The attract demo runs this gauntlet pilot with no human opponent, so it needs
    // its own power-attack branch. Without it, Wedge's plow and every other heavy are
    // absent from the kiosk loop even though the duel pilot can use them. Commit when
    // the target is inside a plow lane; the program owns the charge and active shape.
    // A heavy roots the body, so never hold it under the compactor: that branch turned
    // the Recycling Bin into a wave-1 wipe when every pilot rooted into the arm.
    if (this.heavyHold > 0) {
      if (world.pusherActive || world.pusherWarnT > 0) {
        this.heavyHold = 0;
      } else {
        this.heavyHold -= SIM_DT;
        out.mx = ux * 0.5;
        out.my = uy * 0.5;
        out.held |= ACTION.CANDLE;
        return true;
      }
    }
    if (
      this.heavyCd <= 0 &&
      !blocked &&
      !world.pusherActive &&
      world.pusherWarnT <= 0 &&
      me.laserCd <= 0 &&
      me.laserT <= 0 &&
      me.wedgeT <= 0 &&
      me.waveT <= 0 &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      me.energy >= 50 &&
      dist > (kind === 0 && (worms[idx]?.bossKind ?? -1) >= 0 ? 300 : 110) &&
      dist < 440
    ) {
      out.mx = ux * 0.5;
      out.my = uy * 0.5;
      out.pressed |= ACTION.CANDLE;
      out.held |= ACTION.CANDLE;
      this.heavyCount++;
      this.heavyHold = me.program === PROGRAM_ID.FISHER ? 2.6 : 1.4;
      this.heavyCd = this.rng.range(11, 17);
      return true;
    }

    // Overcharge turns ranged fire into a held beam. A one-frame tap barely shows, so
    // hold the button for a burst and strafe the line across the target.
    const overcharged = me.powerupKind === POWERUP_KIND.OVERCHARGE && me.powerupT > 0;
    if (overcharged && me.lockActive && !blocked && dist < 380 && me.swingPhase === 0 && me.dashT <= 0) {
      if (this.beamHoldT <= 0 && this.fireCd <= 0) {
        this.beamHoldT = this.rng.range(0.7, 1.2);
        this.fireCd = this.beamHoldT + 0.5;
        out.pressed |= ACTION.BOLT;
      }
      if (this.beamHoldT > 0) {
        out.held |= ACTION.BOLT;
        out.mx = -uy * this.strafeDir;
        out.my = ux * this.strafeDir;
        return true;
      }
    }

    // Fire while walking at the target when there is no lock; the shot leaves along the
    // movement direction. Cover stops the shot, so the pilot routes around it first.
    if (
      !blocked &&
      this.fireCd <= 0 &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      me.burstCd <= 0 &&
      me.burstLeft > 0 &&
      me.energy >= BOLT.cost &&
      dist < 380
    ) {
      out.pressed |= ACTION.BOLT;
      this.fireCd = this.rng.range(this.tune.fireMin, this.tune.fireMax);
      if (!me.lockActive) {
        out.mx = Math.cos(aim) * 0.82;
        out.my = Math.sin(aim) * 0.82;
        return true;
      }
    }
    // Never swing at a body whose radius is larger than the swing itself.
    const giant = kind === 0 && (worms[idx]?.bossKind ?? -1) >= 0;
    if (!giant && dist < PLAYER.swingReach * me.meleeReachMult + 6 && me.swingPhase === 0 && this.swingCd <= 0) {
      out.mx = ux;
      out.my = uy;
      out.pressed |= ACTION.SWING;
      this.swingCd = 0.42;
      return true;
    }

    let moveX = ux;
    let moveY = uy;
    if (blocked || this.gapBlocked(me, tx, ty, world.arena)) {
      if (this.followPath(me, tx, ty, world.arena)) {
        moveX = this.detourX;
        moveY = this.detourY;
      }
    } else {
      // Continuous standoff: approach far away, orbit at the hold distance, back off
      // only when genuinely crowded. A hard `too close` switch made the pilot pump in
      // and out every time it straddled the line. A mini-boss is a much larger body: its
      // head radius alone is 138, so holding 150 from its centre is standing inside it.
      const bossTarget = kind === 0 && (worms[idx]?.bossKind ?? -1) >= 0;
      // Hold outside what the add can actually reach: a worm's bite and a body's contact are
      // both shorter than a bolt, so 265 keeps a clean firing band instead of trading inside
      // the crowd at 150. Boss bodies keep their much wider 330.
      const hold = bossTarget ? 330 : kind === 0 ? 265 : 210;
      const band = bossTarget ? 90 : 70;
      const radial = Math.max(-1, Math.min(1, (dist - hold) / band));
      const orbit = (1 - Math.abs(radial)) * this.strafeDir;
      moveX = ux * radial - uy * orbit;
      moveY = uy * radial + ux * orbit;
    }
    this.applySeparation(world, me, moveX, moveY);
    this.avoidFurniture(me, moveX, moveY, world);
    const mag = Math.hypot(this.steerX, this.steerY);
    if (mag > 0.001) {
      const speed = mag > 1 ? 1 / mag : 0.85;
      out.mx = this.steerX * speed;
      out.my = this.steerY * speed;
    }
    return true;
  }

  /**
   * The last word on any frame. Every branch inside the engagement returns early (heavy,
   * beam, fire, melee, pathing), and so do the reflex, guard and wall branches above it, so
   * a boss escape called from the engagement alone only ran on the frames nothing else
   * happened — which is never the frame the body arrives. Leaving the lane outranks the
   * plan the pilot just made.
   */
  /** Boss model on every exit: the assault must not be skipped by an early return. */
  /** Swept floor contact: a narrow seam is invisible to an endpoint lookahead. */
  private floorSweep(world: World, me: Player, out: InputFrame): void {
    const on = (x: number, y: number) => !world.offFloor(x, y);
    const travel = PLAYER.speed * 0.25;
    const clear = (mx: number, my: number): boolean => {
      for (let i = 1; i <= 10; i++) { const k = (travel * i) / 10; if (!on(me.x + mx * k, me.y + my * k)) return false; }
      return true;
    };
    if (out.mx !== 0 || out.my !== 0) {
      const len = Math.hypot(out.mx, out.my) || 1; const mx = out.mx / len; const my = out.my / len;
      if (clear(mx, my)) return;
      for (const a of [0.5, -0.5, 1, -1, 1.6, -1.6, 2.2, -2.2]) {
        const c = Math.cos(a); const s2 = Math.sin(a);
        const rx = mx * c - my * s2; const ry = mx * s2 + my * c;
        if (!clear(rx, ry)) continue;
        out.mx = rx; out.my = ry; return;
      }
      out.mx = -mx; out.my = -my; return;
    }
    let bx = 0; let by = 0; let bd = Infinity;
    for (let r = 6; r <= 140; r += 6) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2; const px = me.x + Math.cos(a) * r; const py = me.y + Math.sin(a) * r;
        if (!on(px, py)) continue; if (r < bd) { bd = r; bx = px; by = py; }
      }
      if (bd < Infinity) break;
    }
    if (bd < Infinity) { out.mx = (bx - me.x) / (bd || 1); out.my = (by - me.y) / (bd || 1); }
  }

  /** Assault objective: close every live ingress port, then stand in the party port. */
  private objectiveFrame(world: World, me: Player, out: InputFrame): void {
    if (world.campaignPhase !== 'assault' || world.portTotal <= 0) return;
    let threatD = Infinity;
    for (const w of world.worms as any[]) if (w.active && w.hp > 0) threatD = Math.min(threatD, Math.hypot(w.x - me.x, w.y - me.y));
    for (const s2 of world.sentries as any[]) {
      if (!s2.active) continue;
      if (s2.kind >= 4 && s2.kind <= 6 && s2.shapeState < 2) continue;
      threatD = Math.min(threatD, Math.hypot(s2.x - me.x, s2.y - me.y));
    }
    const target = (b: any) => {
      const cx = b.x + b.w * 0.5; const cy = b.y + b.h * 0.5;
      const dx = cx - me.x; const dy = cy - me.y; const d = Math.hypot(dx, dy) || 1;
      // Keep a non-zero move vector all the way in. One-stick facing comes from movement:
      // stopping at a standoff let `floorSweep` substitute a nearest-floor step, which turned
      // the body away from the feed and sent every bolt past it. Pressing the port keeps the
      // face on the target (and a solid prop just stops the body in place). Cover in the
      // direct line gets the same A* detour the combat objective uses.
      const covered = this.lineBlocked(me, cx, cy, world.arena.pillars)
        || this.gapBlocked(me, cx, cy, world.arena);
      if (covered && this.followPath(me, cx, cy, world.arena)) {
        out.mx = this.detourX;
        out.my = this.detourY;
      } else {
        out.mx = dx / d;
        out.my = dy / d;
      }
      out.held |= ACTION.BOLT;
      if (threatD < 340) out.held |= ACTION.SWING;
      this.steerBranch = 'port';
    };
    if (world.campaignExitReady) {
      // The exit ends the level the moment a body stands in it: commit, guard up, no fight.
      // The exit is a place to stand in, not a thing to shoot from range: walk all the way in.
      for (const b of world.props as any[]) {
        if (!b.active || !b.portalExit) continue;
        const cx = b.x + b.w * 0.5;
        const cy = b.y + b.h * 0.5;
        const dx = cx - me.x;
        const dy = cy - me.y;
        const d = Math.hypot(dx, dy) || 1;
        out.mx = dx / d;
        out.my = dy / d;
        if (threatD < 260) out.held |= ACTION.SWING;
        this.steerBranch = 'exit';
        return;
      }
      return;
    }
    if (threatD < 210) return;
    let port: any = null; let pd = Infinity;
    for (const b of world.props as any[]) {
      if (!b.active || !b.portal || b.portalExit) continue;
      if ((b.hp ?? 0) <= 0) continue;
      const d = Math.hypot(b.x + b.w * 0.5 - me.x, b.y + b.h * 0.5 - me.y);
      if (d < pd) { pd = d; port = b; }
    }
    if (port) target(port);
  }

  private bossFrame(world: World, me: Player, out: InputFrame): void {
    if (this.fightBoss(world, me, out)) return;
    this.bossEscape(world, me, out);
  }

  private bossEscape(world: World, me: Player, out: InputFrame): void {
    if (this.closeBodyDash(world, me, out)) return;
    this.megaLaneRead(world, me, out);
  }

  /**
   * Mini-boss movement model. A latched pass runs through wherever the pilot stands, so the
   * standoff is defined by being outside the sweep's reach rather than by closing distance:
   * hold a wide ring while the body travels, stay off the chain's corridor, punish the park
   * from bolt range, heal before a contact the current pool would not survive, and dash out
   * when anything is already inside its own reach.
   */
  private fightBoss(world: World, me: Player, out: InputFrame): boolean {
    let boss: any = null;
    for (let i = 0; i < world.worms.length; i++) {
      const w = world.worms[i] as any;
      if (w.active && w.bossKind >= 0) {
        boss = w;
        break;
      }
    }
    if (!boss) return false;

    // Every shooter family, whichever array it lives in: packs, pods and flocks all fire the
    // same hostile bolts, and a pack can drop in the pilot's face mid-punish.
    const shooters: any[] = [];
    for (const arr of [(world as any).sentries, (world as any).pods, (world as any).flocks, (world as any).homingPods]) {
      if (!Array.isArray(arr)) continue;
      for (const e of arr) {
        if (e && e.active && (e.hp === undefined || e.hp > 0)) shooters.push(e);
      }
    }
    // Bolts already in the air are guarded through traversal, not only inside a reflex window.
    let nearBolts = 0;
    for (const pr of ((world as any).projectiles ?? [])) {
      if (!pr || !pr.active) continue;
      if (!(pr.hostile || pr.src >= 1 || pr.type >= 3)) continue;
      if (Math.hypot(pr.x - me.x, pr.y - me.y) < 340) nearBolts++;
    }
    const guardUp = nearBolts > 0;

    // Anything already inside its own reach outranks the plan.
    if (this.closeBodyDash(world, me, out)) {
      this.steerBranch = 'dash-out';
      return true;
    }

    // Hard clearance outranks the plan: a pass is staged through the pilot's latched station,
    // so being close to the body when it launches is a contact no reaction can beat.
    const crx = me.x - boss.x;
    const cry = me.y - boss.y;
    const cbd = Math.hypot(crx, cry) || 1;
    if (cbd < 260) {
      out.mx = crx / cbd;
      out.my = cry / cbd;
      out.held |= ACTION.LOCK | ACTION.BOLT;
      if (cbd < 200 && ((me as any).dashCharges ?? 0) > 0) out.pressed |= ACTION.DASH;
      this.steerBranch = 'clear';
      return true;
    }

    // A drawn RESTORE drop before a window the current pool would not survive.
    if (me.hp <= 2) {
      let gx = 0;
      let gy = 0;
      let gd = 1400;
      let found = false;
      for (let i = 0; i < world.pickups.length; i++) {
        const k = world.pickups[i];
        if (!k.active || k.kind !== POWERUP_KIND.RESTORE) continue;
        const d = Math.hypot(k.x - me.x, k.y - me.y);
        if (d < gd) {
          gd = d;
          gx = k.x;
          gy = k.y;
          found = true;
        }
      }
      if (found) {
        const dx = gx - me.x;
        const dy = gy - me.y;
        const d = Math.hypot(dx, dy) || 1;
        out.mx = dx / d;
        out.my = dy / d;
        out.held |= ACTION.LOCK;
        this.steerBranch = 'heal';
        return true;
      }
    }

    // A live shooter is the first target at any distance: it chips through a whole cycle if
    // it is left alone, and it can be answered from outside its own firing band.
    let gun: any = null;
    let gunD = Infinity;
    for (const sh of shooters) {
      const d = Math.hypot(sh.x - me.x, sh.y - me.y);
      if (d < gunD) {
        gunD = d;
        gun = sh;
      }
    }
    if (gun) {
      const dx = gun.x - me.x;
      const dy = gun.y - me.y;
      const d = Math.hypot(dx, dy) || 1;
      const band = 395;
      if (d > band + 40) {
        out.mx = dx / d;
        out.my = dy / d;
      } else if (d < band - 40) {
        out.mx = -dx / d;
        out.my = -dy / d;
      } else {
        out.mx = (-dy / d) * this.strafeDir;
        out.my = (dx / d) * this.strafeDir;
      }
      out.held |= ACTION.LOCK | ACTION.BOLT;
      // Face the gunner and keep the shield up while traversing: this is the chip that was
      // killing it between punish windows.
      out.held |= ACTION.SWING;
      if (d < 220 && ((me as any).dashCharges ?? 0) > 0) {
        out.mx = -dx / d;
        out.my = -dy / d;
        out.pressed |= ACTION.DASH;
      }
      this.steerBranch = 'sentry';
      return true;
    }

    const bSpeed = Math.hypot(boss.vx, boss.vy);
    const rx = me.x - boss.x;
    const ry = me.y - boss.y;
    const bd = Math.hypot(rx, ry) || 1;

    if (bSpeed <= 120) {
      // Punish the park from behind the side the body will leave toward: the latched pass
      // runs away from that bearing, so standing there cannot be run through. Its facing is
      // drawn, which is what a player reads to pick the safe side.
      // The pass flies along the drawn facing, so the safe station is beside that axis, not on
      // it: standing "behind" the head meant walking through the head to get there, which is
      // exactly where the ~155 contacts came from.
      const fx = Math.cos(boss.angle ?? 0);
      const fy = Math.sin(boss.angle ?? 0);
      const prx0 = me.x - boss.x;
      const pry0 = me.y - boss.y;
      const side = prx0 * -fy + pry0 * fx >= 0 ? 1 : -1;
      const tx = boss.x + -fy * side * this.punishR;
      const ty = boss.y + fx * side * this.punishR;
      const dx = tx - me.x;
      const dy = ty - me.y;
      const d = Math.hypot(dx, dy) || 1;
      const prx = me.x - boss.x;
      const pry = me.y - boss.y;
      const pbd = Math.hypot(prx, pry) || 1;
      if (pbd < this.punishR + 80) {
        // Getting behind the body must not mean walking through it: orbit at radius while
        // sliding around the head, never let the straight line to the punish spot cross it.
        out.mx = (-pry / pbd) * this.strafeDir + (prx / pbd) * 0.7;
        out.my = (prx / pbd) * this.strafeDir + (pry / pbd) * 0.7;
      } else {
        out.mx = dx / d;
        out.my = dy / d;
      }
      out.held |= ACTION.LOCK | ACTION.BOLT;
      if (guardUp || (this.threatSerial >= 0 && this.threatTime < 0.9)) out.held |= ACTION.SWING;
      this.steerBranch = 'punish';
      return true;
    }

    const ux = boss.vx / bSpeed;
    const uy = boss.vy / bSpeed;
    const along = rx * ux + ry * uy;
    const perp = -rx * uy + ry * ux;
    const side = perp >= 0 ? 1 : -1;
    let mx = 0;
    let my = 0;
    // The ramp takes the body to 1645 u/s, so a fixed ring is only safe early: give a faster
    // pass proportionally more room (its closing speed times a reaction beat, plus reach).
    const ring = Math.max(this.ringR, bSpeed * 0.9);
    if (bd < ring) {
      mx += rx / bd;
      my += ry / bd;
    }
    if (Math.abs(perp) < 320 && along > -2400) {
      mx += -uy * side;
      my += ux * side;
    }
    const m = Math.hypot(mx, my);
    if (m > 0.001) {
      out.mx = mx / m;
      out.my = my / m;
    }
    out.held |= ACTION.LOCK;
    if (bd < 380 && !this.lineBlocked(me, boss.x, boss.y, world.arena.pillars)) out.held |= ACTION.BOLT;
    if (guardUp || (this.threatSerial >= 0 && this.threatTime < 0.9)) out.held |= ACTION.SWING;
    this.steerBranch = 'ring';
    return true;
  }

  /**
   * A body already inside its contact radius cannot be out-walked: the answer is a dash out
   * of it. This fires on the same visible geometry the player reads (position and size).
   */
  private closeBodyDash(world: World, me: Player, out: InputFrame): boolean {
    if (((me as any).dashCharges ?? 0) <= 0) return false;
    for (let i = 0; i < world.worms.length; i++) {
      const w = world.worms[i];
      if (!w.active) continue;
      const dx = me.x - w.x;
      const dy = me.y - w.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > (w.bossKind >= 0 ? 210 : 130)) continue;
      out.mx = dx / d;
      out.my = dy / d;
      out.pressed |= ACTION.DASH;
      return true;
    }
    return false;
  }

  /**
   * A mini-boss pass is drawn as a straight line, so it can be read: the pilot steps off the
   * lane the body is about to sweep and dashes out when it is already close. Nothing hidden
   * is read here — heading and position are exactly what the player sees.
   */
  private megaLaneRead(world: World, me: Player, out: InputFrame): boolean {
    for (let i = 0; i < world.worms.length; i++) {
      const w = world.worms[i];
      if (!w.active || w.bossKind < 0) continue;
      const speed = Math.hypot(w.vx, w.vy);
      // A parked or assembling body sweeps nothing, so it is not a lane to leave.
      if (speed < 60) continue;
      const ux = w.vx / speed;
      const uy = w.vy / speed;
      const rx = me.x - w.x;
      const ry = me.y - w.y;
      // `along` is how far ahead of the body the player is. The old gate only reacted
      // inside 300 units, which at 940 u/s is a third of a second: the pilot was always
      // already in contact before it moved. Read the whole approach instead.
      const along = rx * ux + ry * uy;
      const perp = -rx * uy + ry * ux;
      // The head is 138 across and the chain plates are 99, so a pass sweeps a corridor
      // wider than any standoff. Abandon the whole corridor, not the thin centre line — and
      // include the chain, which trails ~13 plates * 168 behind the head and hurts too.
      // Every pass is latched through the station the pilot holds when the line is set, so
      // the only way out is lateral distance gained *before* the body arrives. At 1100+ u/s
      // a 1400-unit look-ahead is barely a second at walking speed; read the whole lane and
      // buy distance with the dash instead of trying to out-step contact.
      const chainReach = 2600;
      const bd = Math.hypot(rx, ry);
      // Only a genuine emergency overrides the ring model: inside the corridor and near
      // enough to matter. Otherwise the pilot fights instead of strafing the line forever.
      if (bd > 760 && Math.abs(perp) > 300) continue;
      if (along > 2600 || along < -chainReach || Math.abs(perp) > 520) continue;
      const side = perp >= 0 ? 1 : -1;
      out.mx = -uy * side;
      out.my = ux * side;
      const charges = (me as any).dashCharges ?? (me as any).dashLeft ?? 0;
      if (Math.abs(perp) < 420 && along > -200 && charges > 0 && this.laneDashT <= 0) {
        out.pressed |= ACTION.DASH;
        this.laneDashT = 1.15;
      }
      return true;
    }
    return false;
  }

  /** Reads the pilot's sticky hostile into hostileX/Y. False when it is gone. */
  private hostileActive(world: World): boolean {
    const kind = this.hostileKind;
    const idx = this.hostileIdx;
    if (kind < 0 || idx < 0) return false;
    const list =
      kind === 0
        ? world.worms
        : kind === 1
          ? world.viruses
          : kind === 2
            ? world.sentries
            : kind === 3
              ? world.errors
              : null;
    if (!list || idx >= list.length) return false;
    const e = list[idx];
    if (!e.active) return false;
    const sentry = e as { kind?: number; shapeState?: number };
    if (kind === 2 && (sentry.kind ?? 0) >= 4 && (sentry.kind ?? 0) <= 6 && (sentry.shapeState ?? 0) < 2) return false;
    this.hostileX = e.x;
    this.hostileY = e.y;
    return true;
  }

  private steerX = 0;
  private steerY = 0;
  /** Paces the lane dash: one charge per pass, so the pilot is not left empty. */
  private laneDashT = 0;
  /** Which branch steered this frame. Printed by QA runs so steering is visible, not implied. */
  steerBranch = 'idle';
  /** Ring radius scales with the pilot's style, so a batch steers genuinely different lines. */
  get ringR(): number {
    return 620 + this.style * 45;
  }
  /** Distance it punishes a parked body from, behind the side the body will leave toward. */
  get punishR(): number {
    return 330 + this.style * 25;
  }

  private nearWall(me: Player, arena: ArenaDef): boolean {
    // A round platter's rim is handled by the furniture steer, which knows where the
    // holes are. Pulling to the square bounds' centre would skip that read.
    if (arena.disc) return false;
    // Only the outer ring counts. A bot beside interior cover must navigate, not
    // abandon the chase and shove itself into that cover on the way to center.
    const safe = 64;
    const b = arena.bounds;
    return me.x < b.left + safe || me.x > b.right - safe || me.y < b.top + safe || me.y > b.bottom - safe;
  }

  private targetAlive(world: World): boolean {
    if (this.target < 0 || this.target >= world.players.length) return false;
    const p = world.players[this.target];
    // A cloaked body is not a visible target. The bot re-picks instead of chasing a
    // ghost it cannot see, which is what makes the cloak read as invisibility.
    return p.active && p.alive && p.cloakT <= 0;
  }

  private pickTarget(world: World, me: Player): void {
    let best = -1;
    let bestScore = 1e12;
    // Campaign companions are on the player's side for the whole run. They never
    // target another player or bot, even if the human shoots them. Their fire is
    // filtered in `World.damagePlayer`, so this is a rule, not a temporary truce.
    const companion = world.campaign && this.slot > 0;
    for (let i = 0; i < world.players.length; i++) {
      if (i === this.slot) continue;
      if (companion) continue;
      const p = world.players[i];
      if (!p.active || !p.alive || p.cloakT > 0) continue;
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

  private handleThreat(me: Player, out: InputFrame, arena: ArenaDef, usbT = 0): boolean {
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

    // Raise the shield against an incoming shot that is still outside melee reach.
    // The guard reflects every shot in front for a second, so it beats a swat at
    // range; the dodge and Wedge's wall stay in the mix. Sentry bolts are types 3
    // and 4, not the player bolt type 0, which is why the pilot used to ignore
    // every gauntlet shot instead of reflecting it.
    if (
      !this.threatOwn &&
      canDeflectShot(this.threatType) &&
      me.guardT <= 0 &&
      me.guardCd <= 0 &&
      this.guardCd <= 0 &&
      me.swingPhase === 0 &&
      me.dashT <= 0 &&
      dist > PLAYER.swingReach * me.meleeReachMult + 10 &&
      this.threatTime > 0.12 &&
      this.threatTime < 0.62 &&
      this.rng.next() < 0.85
    ) {
      // Turn to face the shot while the shield arms. The guard only catches the
      // front half-plane, so a shot arriving from behind has to be dodged instead.
      out.mx = dirX * 0.45;
      out.my = dirY * 0.45;
      out.held |= ACTION.SWING;
      this.guardHoldT = 0.42;
      // A shorter breather than the old 1.2-2.4 s makes the shield a visible part
      // of the kit, while still leaving the dodge as the answer between guards.
      this.guardCd = this.rng.range(0.9, 1.8);
      return true;
    }

    // Close shots are swatted rather than guarded; the lash reflects hostile sentry
    // fire too. Own bolts are a ricochet problem, so evade rather than trying to
    // re-deflect a bad shot.
    if (
      !this.threatOwn &&
      canDeflectShot(this.threatType) &&
      dist < PLAYER.swingReach * me.meleeReachMult + 14 &&
      me.swingPhase === 0 &&
      this.swingCd <= 0
    ) {
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
      let side = (this.strafeDir >= 0 ? 1 : -1) * (this.rng.next() < 0.5 ? -1 : 1);
      // Dodge away from the bolt, but never off the lip: flip the slide if that side is
      // void, and if both sides are void take the walk instead of the dash.
      if (!this.dashSafe(arena, me.x, me.y, (-vy / vm) * side, (vx / vm) * side, usbT)) {
        if (this.dashSafe(arena, me.x, me.y, (vy / vm) * side, (-vx / vm) * side, usbT)) side = -side;
        else side = 0;
      }
      if (side !== 0) {
        out.mx = (-vy / vm) * side;
        out.my = (vx / vm) * side;
        out.pressed |= ACTION.DASH;
        this.strafeDir = -this.strafeDir;
        return true;
      }
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
    const shotSpeed = me.program === PROGRAM_ID.PINBALL
      ? PINBALL.shotSpeed
      : me.program === PROGRAM_ID.AIMBOT
        ? AIMBOT.shotSpeed
        : BOLT.speed;
    const boltSpeed = shotSpeed * BOLT.enemySpeedMult;
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

  /**
   * A dash commits the body for `dashSpeed * dashTime` units. On a walled arena the wall
   * collects it; on an open one that is a fall, so refuse the ones that end in the void.
   */
  private dashSafe(arena: ArenaDef, x: number, y: number, dx: number, dy: number, usbT = 0): boolean {
    if (arena.walls !== 'open') return true;
    const reach = PLAYER.dashSpeed * PLAYER.dashTime + PLAYER.radius + 24;
    const ex = x + dx * reach;
    const ey = y + dy * reach;
    const b = arena.bounds;
    if (ex <= b.left + 24 || ex >= b.right - 24 || ey <= b.top + 24 || ey >= b.bottom - 24) return false;
    const disc = arena.disc;
    if (disc) {
      const dx = ex - (b.left + b.right) * 0.5;
      const dy = ey - (b.top + b.bottom) * 0.5;
      if (dx * dx + dy * dy > (disc.radius - 24) * (disc.radius - 24)) return false;
    }
    const voids = arena.voids;
    if (voids) {
      // Landing over a hole is the same mistake as landing past the lip.
      for (let i = 0; i < voids.length; i++) {
        const r = voids[i];
        if (ex > r.x - 8 && ex < r.x + r.w + 8 && ey > r.y - 8 && ey < r.y + r.h + 8) return false;
      }
    }
    if (arena.usb && !usbFloorAt(arena, ex, ey, usbT)) return false;
    return true;
  }

  private avoidFurniture(me: Player, x: number, y: number, world: World): void {
    let sx = this.steerX;
    let sy = this.steerY;
    const arena = world.arena;
    const b = arena.bounds;

    const margin = PLAYER.radius + 44;
    if (me.x < b.left + margin) sx += (b.left + margin - me.x) / 90;
    if (me.x > b.right - margin) sx -= (me.x - (b.right - margin)) / 90;
    if (me.y < b.top + margin) sy += (b.top + margin - me.y) / 90;
    if (me.y > b.bottom - margin) sy -= (me.y - (b.bottom - margin)) / 90;

    if (arena.walls === 'open') {
      // No wall to save a bad read, so the lip gets a much wider, harder steer than the
      // walled nudge. A bot chasing a body toward the edge has to beat this to fall.
      const lip = 130;
      if (me.x < b.left + lip) sx += (b.left + lip - me.x) / 45;
      if (me.x > b.right - lip) sx -= (me.x - (b.right - lip)) / 45;
      if (me.y < b.top + lip) sy += (b.top + lip - me.y) / 45;
      if (me.y > b.bottom - lip) sy -= (me.y - (b.bottom - lip)) / 45;
    }

    if (arena.usb) {
      // The drive gaps are live. The grid cannot represent them, so a bot already off
      // the plates gets a hard pull toward the hub; this is a recovery steer, not a route.
      if (!usbFloorAt(arena, me.x, me.y, world.usbT)) {
        const cx = usbCenterX(arena);
        const cy = usbCenterY(arena);
        sx += (cx - me.x) / 18;
        sy += (cy - me.y) / 18;
      }
    }

    const disc = arena.disc;
    if (disc) {
      // A round floor has no straight lip, so steer back toward the spindle. The band
      // starts further in than a square edge because the rim curves away underfoot.
      const dcx = discCenterX(arena);
      const dcy = discCenterY(arena);
      const rx = me.x - dcx;
      const ry = me.y - dcy;
      const rd = Math.hypot(rx, ry) || 1;
      const lip = disc.radius - 130;
      if (rd > lip) {
        sx -= (rx / rd) * ((rd - lip) / 30);
        sy -= (ry / rd) * ((rd - lip) / 30);
      }
      // The holes turn with the plate, so read them at the world's current phase.
      for (let i = 0; i < disc.holes.length; i++) {
        const hx = discHoleX(arena, i, world.discT);
        const hy = discHoleY(arena, i, world.discT);
        const dx = me.x - hx;
        const dy = me.y - hy;
        const d = Math.hypot(dx, dy) || 1;
        const reach = disc.holes[i].radius + 96;
        if (d >= reach) continue;
        sx += (dx / d) * ((reach - d) / 20);
        sy += (dy / d) * ((reach - d) / 20);
      }
    }

    const voids = arena.voids;
    if (voids) {
      // Holes are not cover: the floor is missing, so steer around the rim instead of
      // trying to walk the edge. A compactor slam can still slide a bot in.
      for (let i = 0; i < voids.length; i++) {
        const r = voids[i];
        const cx = r.x + r.w * 0.5;
        const cy = r.y + r.h * 0.5;
        const dx = me.x - cx;
        const dy = me.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        // Start braking almost two body-lengths out: a bot at speed needs that much room to
        // reverse before the rim, and the old 54 was not enough.
        const reach = Math.max(r.w, r.h) * 0.5 + 96;
        if (d >= reach) continue;
        sx += (dx / d) * ((reach - d) / 22);
        sy += (dy / d) * ((reach - d) / 22);
      }
    }

    // Storm clouds rain straight down. The lane under the body is where every drop
    // lands, so step out of it rather than standing in the drizzle; the cloud is
    // reachable from the side and the lane is wider than a body.
    for (let i = 0; i < world.worms.length; i++) {
      const w = world.worms[i];
      if (!w.active || w.bossKind !== MINIBOSS.STORM_CLOUD) continue;
      const under = me.y - w.y;
      if (under < 30) continue;
      const off = me.x - w.x;
      const half = STORM_CLOUD.rain.width * 0.5 + PLAYER.radius + 28;
      if (Math.abs(off) > half) continue;
      const side = off >= 0 ? 1 : -1;
      const urgency = under < 240 ? 2.4 : 1.3;
      sx += side * urgency;
    }

    // Emitter lanes are readable before they fire. Step out of the corridor instead of
    // standing in the crossing while the gather ring completes.
    if (world.emitters.length > 0) {
      for (let i = 0; i < world.emitters.length; i++) {
        const e = world.emitters[i];
        if (e.phase === 0) continue;
        const ax = Math.cos(e.angle);
        const ay = Math.sin(e.angle);
        const dx = me.x - e.x;
        const dy = me.y - e.y;
        const forward = dx * ax + dy * ay;
        const reach = e.phase === 2 ? e.beamDist : EMITTER.range;
        if (forward < -PLAYER.radius || forward > reach + 40) continue;
        const lateral = dx * ay - dy * ax;
        const clearance = EMITTER.halfWidth + PLAYER.radius + 138;
        if (Math.abs(lateral) > clearance) continue;
        // Move away from the beam line, not toward it. `lateral` is the signed
        // cross product; its sign is the side of the lane the body is on. Give the
        // fighter enough lead time to clear the corridor while the lens gathers.
        const side = lateral >= 0 ? 1 : -1;
        const urgency = e.phase === 2 ? 3 : 1.4 + e.charge * 2;
        sx += ay * side * urgency;
        sy += -ax * side * urgency;
      }
    }

    // Round furniture is not in the grid, so add a soft radial steer. A kicker gets a
    // wider berth than a passive post because its launch is stronger than a wall slide.
    if (arena.bumpers) {
      for (let i = 0; i < arena.bumpers.length; i++) {
        const b = arena.bumpers[i];
        const dx = me.x - b.x;
        const dy = me.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        const reach = b.radius + PLAYER.radius + (b.kind === 1 ? 76 : 48);
        if (d >= reach) continue;
        const push = (reach - d) / 20;
        sx += (dx / d) * push;
        sy += (dy / d) * push;
      }
    }

    // A keypad cap is a moving wall. The grid cannot know which cap is down, so the
    // pilot steers around the current state; warnings get a wider berth because the
    // slam is lethal and the key is not yet solid.
    const keypad = world.keypad;
    if (keypad) {
      for (let i = 0; i < keypad.keys.length; i++) {
        const k = keypad.keys[i];
        const ks = world.keypadStates[i];
        if (
          ks !== KEYPAD_STATE.warn &&
          ks !== KEYPAD_STATE.slam &&
          ks !== KEYPAD_STATE.down &&
          ks !== KEYPAD_STATE.rise
        ) {
          continue;
        }
        const cx = k.x + k.w * 0.5;
        const cy = k.y + k.h * 0.5;
        const dx = me.x - cx;
        const dy = me.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        const reach = Math.max(k.w, k.h) * 0.5 + PLAYER.radius + (ks === KEYPAD_STATE.warn ? 78 : 26);
        if (d >= reach) continue;
        const push = ((reach - d) / 22) * (ks === KEYPAD_STATE.warn ? 1.5 : 1);
        sx += (dx / d) * push;
        sy += (dy / d) * push;
      }
    }

    // Browser page cards swap with the current forum page, so the grid cannot represent
    // them. Steer around the nearest point on each active card instead.
    if (world.browser) {
      for (let i = 0; i < world.browserSolids.length; i++) {
        const r = world.browserSolids[i];
        const nx = Math.max(r.x, Math.min(me.x, r.x + r.w));
        const ny = Math.max(r.y, Math.min(me.y, r.y + r.h));
        let dx = me.x - nx;
        let dy = me.y - ny;
        if (dx * dx + dy * dy < 0.01) {
          dx = me.x - (r.x + r.w * 0.5);
          dy = me.y - (r.y + r.h * 0.5);
        }
        const d = Math.hypot(dx, dy) || 1;
        const reach = PLAYER.radius + 34;
        if (d >= reach) continue;
        const push = (reach - d) / 16;
        sx += (dx / d) * push;
        sy += (dy / d) * push;
      }
    }

    // BUSINESS LAPTOP cards and preview blocks move with the mail clock. Treat each
    // live rectangle as a repulsor because the static grid cannot represent it.
    if (world.laptop) {
      for (let i = 0; i < world.laptopSolids.length; i++) {
        const r = world.laptopSolids[i];
        if (r.w <= 0 || r.h <= 0) continue;
        const nx = Math.max(r.x, Math.min(me.x, r.x + r.w));
        const ny = Math.max(r.y, Math.min(me.y, r.y + r.h));
        let dx = me.x - nx;
        let dy = me.y - ny;
        if (dx * dx + dy * dy < 0.01) {
          dx = me.x - (r.x + r.w * 0.5);
          dy = me.y - (r.y + r.h * 0.5);
        }
        const d = Math.hypot(dx, dy) || 1;
        const reach = PLAYER.radius + 30;
        if (d >= reach) continue;
        const push = (reach - d) / 16;
        sx += (dx / d) * push;
        sy += (dy / d) * push;
      }
    }

    // The route already avoids cover, so the near-field probe only runs on a straight
    // walk. Running both at once made the probe shove the bot off its own path and pin
    // it against cover.
    if (this.routeHoldT > 0) {
      this.steerX = sx;
      this.steerY = sy;
      return;
    }
    const aheadX = me.x + sx * 54;
    const aheadY = me.y + sy * 54;
    const solids = arenaSolids(arena);
    for (let i = 0; i < solids.length; i++) {
      if (!circleRect(aheadX, aheadY, 20, solids[i], hitScratch)) continue;
      // Latch the slide direction for a beat. The probe normal flips whenever the
      // steering wobbles across a corner, and re-applying it every frame made a bot
      // standing its ground shudder in place.
      if (this.avoidT <= 0) {
        this.avoidT = 0.45;
        const nx = hitScratch.nx;
        const ny = hitScratch.ny;
        const tx = -ny * this.strafeDir;
        const ty = nx * this.strafeDir;
        this.avoidDirX = nx * 0.7 + tx * 0.7;
        this.avoidDirY = ny * 0.7 + ty * 0.7;
      }
      sx += this.avoidDirX * 1.4;
      sy += this.avoidDirY * 1.4;
      break;
    }
    this.steerX = sx;
    this.steerY = sy;
  }
}
