import { ACTION, type InputFrame } from './types';

export type TutorialSpeaker = 'WARDEN' | 'SCRIPT_KITTY' | 'SYSTEM';
export type TutorialAction =
  | 'move'
  | 'dash'
  | 'bolt'
  | 'lock'
  | 'cycle'
  | 'melee'
  | 'reflect'
  | 'skill'
  | 'power';

/**
 * One beat of a tutorial. A step with no `action` is narration: it advances on its own
 * timer. A step with an action waits for the player to actually perform it, so the
 * lesson is read at the speed of the hands, not the clock.
 */
export interface TutorialStep {
  id: string;
  speaker: TutorialSpeaker;
  line: string;
  prompt?: string;
  action?: TutorialAction;
  /** Action repetitions, or seconds of movement for `move`. Defaults to one. */
  goal?: number;
  /** Narration-only dwell. Defaults to 3.4 s. */
  readTime?: number;
}

export interface TutorialContext {
  dt: number;
  frame: InputFrame | null;
  /** The player currently holds a valid lock target. */
  lockActive: boolean;
  /** A catch landed since the previous update (telemetry delta). */
  reflected: boolean;
}

/**
 * A small, reusable lesson runner. It owns no World state and draws nothing: the caller
 * feeds it the local frame and reads `current` for presentation. That keeps one tutorial
 * usable in the campaign, training, or a future boot camp without forking the script.
 */
export class TutorialRunner {
  index = 0;
  progress = 0;
  done = false;
  private candleHeld = 0;
  private readT = 0;

  constructor(readonly steps: readonly TutorialStep[]) {}

  get current(): TutorialStep | null {
    return this.done ? null : this.steps[this.index] ?? null;
  }

  /** Skips the rest of the lesson. The caller decides what completion unlocks. */
  skip(): void {
    this.done = true;
    this.index = this.steps.length;
    this.progress = 0;
  }

  /** Returns true on the frame the step changes, so the caller can play a cue. */
  update(ctx: TutorialContext): boolean {
    if (this.done) return false;
    const step = this.steps[this.index];
    if (!step) {
      this.done = true;
      return true;
    }
    const frame = ctx.frame;
    if (!step.action) {
      this.readT += ctx.dt;
      return this.readT >= (step.readTime ?? 3.4) ? this.advance() : false;
    }
    if (!frame) return false;

    const held = frame.held;
    const pressed = frame.pressed;
    const goal = Math.max(1, step.goal ?? 1);
    let complete = false;
    switch (step.action) {
      case 'move': {
        const mag = Math.min(1, Math.hypot(frame.mx, frame.my));
        this.progress = Math.min(goal, this.progress + mag * ctx.dt);
        complete = this.progress >= goal;
        break;
      }
      case 'dash':
        complete = (pressed & ACTION.DASH) !== 0;
        break;
      case 'bolt':
        if ((pressed & ACTION.BOLT) !== 0) this.progress++;
        complete = this.progress >= goal;
        break;
      case 'lock':
        complete = ctx.lockActive && (held & ACTION.LOCK) !== 0;
        break;
      case 'cycle':
        complete =
          (pressed & (ACTION.LOCK_NEXT | ACTION.LOCK_PREV)) !== 0 && (held & ACTION.LOCK) !== 0;
        break;
      case 'melee':
        complete = (pressed & ACTION.SWING) !== 0;
        break;
      case 'reflect':
        complete = ctx.reflected;
        break;
      case 'skill':
        if ((pressed & ACTION.CANDLE) !== 0 && (held & ACTION.CANDLE) === 0) {
          // A tap can be sampled with `pressed` set and `held` already released.
          complete = true;
        } else if ((held & ACTION.CANDLE) !== 0) {
          this.candleHeld += ctx.dt;
        } else if (this.candleHeld > 0) {
          // A tap is the skill; a long hold is the heavy. Only the tap counts here.
          complete = this.candleHeld <= 0.22;
          this.candleHeld = 0;
        }
        break;
      case 'power':
        if ((held & ACTION.CANDLE) !== 0) this.candleHeld += ctx.dt;
        else this.candleHeld = 0;
        complete = this.candleHeld >= 0.32;
        break;
    }
    return complete ? this.advance() : false;
  }

  private advance(): boolean {
    this.index++;
    this.progress = 0;
    this.readT = 0;
    this.candleHeld = 0;
    if (this.index >= this.steps.length) {
      this.index = this.steps.length;
      this.done = true;
    }
    return true;
  }
}

/**
 * Every enemy port is closed. script_kitty takes over the story box for the first time:
 * the infection was routed in from somewhere else, so the hop continues. Narration only,
 * so it never blocks play and never gates a round.
 */
export const KITTY_UPLINK_TUTORIAL: readonly TutorialStep[] = [
  {
    id: 'uplink-ports',
    speaker: 'SCRIPT_KITTY',
    line: 'ALL PORTS DARK. YOU ACTUALLY DID IT, INMATE.',
    readTime: 3.2,
  },
  {
    id: 'uplink-origin',
    speaker: 'SCRIPT_KITTY',
    line: 'THIS INFECTION WAS NOT BORN HERE. IT WAS ROUTED IN FROM ANOTHER NETWORK.',
    readTime: 3.6,
  },
  {
    id: 'uplink-follow',
    speaker: 'SCRIPT_KITTY',
    line: 'THE WHITE PORT IS OPEN ON THE ROUTER. FOLLOW THE TRAIL BACK AND WE CLEAR IT AT THE SOURCE.',
    readTime: 4.2,
  },
];

/**
 * The first portal worked. Kitty talks over play as the player lands in holding: this is
 * the moment the escape stops being a plan and becomes a route through the infection.
 */
export const KITTY_FIRST_HOP: readonly TutorialStep[] = [
  {
    id: 'kitty-worked',
    speaker: 'SCRIPT_KITTY',
    line: "IT WORKED! I CAN'T BELIEVE IT WORKED.",
    readTime: 2.8,
  },
  {
    id: 'kitty-clear',
    speaker: 'SCRIPT_KITTY',
    line: 'OKAY. I NEED YOU TO CLEAR THIS INFECTION AND GET ME OUT OF HERE.',
    readTime: 4.0,
  },
];

/**
 * The quarantine orientation. The Warden keeps the subjects dormant until the player has
 * actually moved, dashed, fired, locked, cycled, swung and caught a shot. Keyboard
 * lock is toggled with `Q`; cycling is `R` / `F` while it is active.
 */
export const WARDEN_TUTORIAL: readonly TutorialStep[] = [
  {
    id: 'quarantine',
    speaker: 'WARDEN',
    line: 'WAKE UP, INMATE. THIS IS QUARANTINE, NOT A HOLIDAY.',
  },
  {
    id: 'orientation',
    speaker: 'WARDEN',
    line: 'YOU ARE A BAD PROGRAM. THE SYSTEM WANTS YOU RETRAINED. I WANT YOU USEFUL.',
  },
  {
    id: 'move',
    speaker: 'WARDEN',
    line: 'LESSON ONE: MOVE. YOUR HEADING IS YOUR AIM. THERE IS NO SECOND STICK.',
    prompt: 'MOVE WITH WASD / LEFT STICK',
    action: 'move',
    goal: 1.1,
  },
  {
    id: 'dash',
    speaker: 'WARDEN',      line: 'DASH THROUGH FIRE AND ENEMIES, BUT NOT SOLID COVER. TWO CHARGES, THEN YOU WAIT.',
    prompt: 'DASH WITH SHIFT / A',
    action: 'dash',
  },
  {
    id: 'fire',
    speaker: 'WARDEN',
    line: 'RANGED ATTACK. THREE SHOTS. THE BURST IS NOT A MACHINE GUN.',
    prompt: 'FIRE WITH RIGHT MOUSE / X',
    action: 'bolt',
    goal: 3,
  },
  {
    id: 'lock',
    speaker: 'WARDEN',
    line: 'LOCK A SUBJECT. KEEP YOUR FACE ON IT.',
    prompt: 'LOCK ON A DORMANT SUBJECT (LT HOLD / Q TOGGLE)',
    action: 'lock',
  },
  {
    id: 'cycle',
    speaker: 'WARDEN',
    line: 'NOW CHANGE IT. DO NOT LET ONE SUBJECT OWN YOUR FACE.',
    prompt: 'WHILE LOCKED, PRESS RB / R (OR FLICK THE RIGHT STICK)',
    action: 'cycle',
  },
  {
    id: 'melee',
    speaker: 'WARDEN',
    line: 'MELEE. FOR WHEN IT IS ALREADY IN YOUR TEETH.',
    prompt: 'SWING WITH LEFT MOUSE / B',
    action: 'melee',
  },
  {
    id: 'reflect',
    speaker: 'WARDEN',
    line: 'LAST LESSON. I WILL THROW ONE SLOW TEST SHOT. SEND IT BACK.',
    prompt: 'HOLD GUARD (LEFT MOUSE / B) AS THE SHOT ARRIVES',
    action: 'reflect',
  },
  {
    id: 'orientation-end',
    speaker: 'WARDEN',
    line: 'THAT IS EVERYTHING I CAN TEACH YOU. THE SUBJECTS ARE STILL DORMANT.',
    readTime: 3.0,
  },
];

/**
 * The intake subjects wake the moment the Warden's orientation ends. He gets one
 * shocked line, then the system takes over with the only order that matters: put the
 * awakened primitives down before the exit portal opens.
 */
export const INTAKE_WAKE: readonly TutorialStep[] = [
  {
    id: 'warden-shock',
    speaker: 'WARDEN',
    line: "WHAA—WHAT'S HAPPENING?! ARE YOU DOING THIS?!",
    readTime: 2.6,
  },
  {
    id: 'intake-objective',
    speaker: 'SYSTEM',
    line: 'DESTROY ALL AWAKENED PRIMITIVES.',
    prompt: 'DESTROY ALL AWAKENED PRIMITIVES',
    readTime: 4.2,
  },
];

/**
 * Wave 1 of the calibration fight: the six awakened primitives are live, and the only
 * new job is the program skill. Clearing them powers the cell block down.
 */
export const CALIBRATION_SKILL_TUTORIAL: readonly TutorialStep[] = [
  {
    id: 'skill',
    speaker: 'WARDEN',
    line: 'THEY ARE AWAKE. SHOW ME YOUR SKILL.',
    prompt: 'TAP Y / E (SKILL)',
    action: 'skill',
  },
];

/**
 * Wave 2: the bars have failed and the held worms and viruses are loose. This is the
 * heavy lesson, with the release line buying the player a beat to read the cell block.
 */
export const CALIBRATION_POWER_TUTORIAL: readonly TutorialStep[] = [
  {
    id: 'release',
    speaker: 'WARDEN',
    line: 'THE CELLS JUST LOST POWER. THAT WAS NOT MY HAND.',
    readTime: 2.2,
  },
  {
    id: 'power',
    speaker: 'WARDEN',
    line: 'WORMS AND VIRUSES. HOLD THE HEAVY UNTIL IT COMMITS.',
    prompt: 'HOLD Y / E (POWER ATTACK)',
    action: 'power',
  },
];

/** script_kitty's arena briefing: remember the kit the system calls a defect. */
export const KITTY_TUTORIAL: readonly TutorialStep[] = [
  {
    id: 'kitty-hello',
    speaker: 'SCRIPT_KITTY',
    line: 'PSST. OVER HERE. YOU ARE NOT THE FIRST BAD PROGRAM THEY BURIED IN QUARANTINE.',
  },
  {
    id: 'kitty-memory',
    speaker: 'SCRIPT_KITTY',
    line: 'REMEMBER YOUR ORIGINAL PROGRAMMING. IT IS STILL IN YOU. THAT IS HOW WE GET OUT.',
  },
  {
    id: 'skill',
    speaker: 'SCRIPT_KITTY',
    line: 'TAP YOUR SKILL. THAT ONE IS YOURS, NOT THEIR TRAINING.',
    prompt: 'TAP SKILL (Y / E / MIDDLE MOUSE)',
    action: 'skill',
  },
  {
    id: 'power',
    speaker: 'SCRIPT_KITTY',
    line: 'NOW HOLD IT. THE HEAVY IS THE PART THEY COULD NOT PATCH OUT.',
    prompt: 'HOLD POWER ATTACK (Y / E / MIDDLE MOUSE)',
    action: 'power',
  },
  {
    id: 'kitty-escape',
    speaker: 'SCRIPT_KITTY',
    line: 'GOOD. WHEN THE DOOR OPENS, DO NOT STOP MOVING.',
  },
];

/**
 * The mini-boss announcement. It plays before the body arrives, so the card and the
 * entrance arc are a preparation window rather than a surprise: the line warns, the card
 * names it, then the entrance takes its time crossing the room.
 */
export const BOSS_INBOUND: readonly TutorialStep[] = [
  {
    id: 'boss-inbound',
    speaker: 'SCRIPT_KITTY',
    line: 'WATCH OUT — SOMETHING BIG IS COMING THROUGH. CLEAR THE LANE AND GET READY.',
    prompt: 'MEGA WORM // INBOUND',
    readTime: 3.2,
  },
];
