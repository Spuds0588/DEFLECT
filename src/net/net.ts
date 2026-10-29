import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { MAX_PLAYERS, MAX_PROJECTILES, NET, PLAYER } from '../game/config';
import { ARENAS, type ArenaDef } from '../game/arenas';
import { createPlayer, createProjectile, playerFlags } from '../game/entities';
import { sanitizeName } from '../game/identity';
import { stepPlayerMotion } from '../game/movement';
import type { World } from '../game/world';
import {
  ACTION,
  PF,
  type GameEvent,
  type InputFrame,
  type LobbyPlayer,
  type LobbyState,
  type Phase,
  type Player,
  type Projectile,
} from '../game/types';

export const MSG = {
  INPUT: 0,
  SNAPSHOT: 1,
  LOBBY: 2,
  PROFILE: 3,
  START: 4,
  HELLO: 5,
  REMATCH: 6,
  ERROR: 7,
} as const;

const PHASES: Phase[] = ['countdown', 'live', 'roundover', 'matchend', 'practice'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode(): string {
  const bytes = new Uint8Array(NET.roomCodeLength);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < bytes.length; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

function peerId(code: string): string {
  return NET.roomPrefix + code;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function openPeer(id?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
    const timer = window.setTimeout(() => {
      cleanup();
      peer.destroy();
      reject(new Error('SIGNALING TIMEOUT'));
    }, 12000);
    const cleanup = (): void => {
      window.clearTimeout(timer);
      peer.off('open', onOpen);
      peer.off('error', onError);
    };
    const onOpen = (): void => {
      cleanup();
      resolve(peer);
    };
    const onError = (err: Error): void => {
      cleanup();
      peer.destroy();
      reject(err);
    };
    peer.on('open', onOpen);
    peer.on('error', onError);
  });
}

interface HostEntry {
  slot: number;
  name: string;
  ready: boolean;
  connected: boolean;
  conn: DataConnection | null;
  lastSeen: number;
  dropped: boolean;
}

export interface HostCallbacks {
  onLobby: (state: LobbyState) => void;
  onGuestLeft: (slot: number, name: string) => void;
  onError: (message: string) => void;
}

export class HostNet {
  readonly inputs: InputFrame[];
  private peer: Peer | null = null;
  private entries: (HostEntry | null)[] = new Array(MAX_PLAYERS).fill(null);
  private inMatch = false;
  private arenaIndex = 0;
  private seq = 0;
  private closed = false;

  code = '';

  constructor(
    hostName: string,
    private callbacks: HostCallbacks,
  ) {
    this.inputs = new Array(MAX_PLAYERS);
    for (let i = 0; i < MAX_PLAYERS; i++) this.inputs[i] = { mx: 0, my: 0, held: 0, pressed: 0 };
    this.entries[0] = {
      slot: 0,
      name: sanitizeName(hostName, 'HOST'),
      ready: true,
      connected: true,
      conn: null,
      lastSeen: 0,
      dropped: false,
    };
  }

  async start(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode();
      try {
        this.peer = await openPeer(peerId(code));
        this.code = code;
        break;
      } catch (err) {
        const type = (err as { type?: string }).type;
        if (type !== 'unavailable-id' && type !== 'invalid-id') {
          throw err;
        }
        console.warn('[DEFLECT-NET] Room code collision, retrying.', type);
      }
    }
    if (!this.peer) throw new Error('Could not allocate a room code');
    if (this.closed) {
      this.peer.destroy();
      this.peer = null;
      throw new Error('ROOM CANCELLED');
    }
    this.peer.on('connection', (conn) => this.accept(conn));
    this.peer.on('error', (err) => {
      const type = (err as { type?: string }).type ?? 'error';
      if (type === 'network' || type === 'server-error' || type === 'socket-error') {
        console.warn('[DEFLECT-NET] Host peer error:', type, err.message);
        this.callbacks.onError('NETWORK UNSTABLE');
      }
    });
    this.emitLobby();
    console.log('[DEFLECT-NET] Hosting room', this.code);
    return this.code;
  }

  getLobbyState(): LobbyState {
    const players: LobbyPlayer[] = [];
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      if (!e || !e.connected) continue;
      players.push({ slot: e.slot, name: e.name, ready: e.ready, connected: e.connected });
    }
    return {
      code: this.code,
      hostSlot: 0,
      canStart: !this.inMatch && players.length >= 2,
      players,
      arenaId: this.arenaIndex,
    };
  }

  getArenaIndex(): number {
    return this.arenaIndex;
  }

  setArena(index: number): void {
    this.arenaIndex = ((index % ARENAS.length) + ARENAS.length) % ARENAS.length;
    if (!this.inMatch) this.emitLobby();
  }

  emitLobby(): void {
    if (this.closed) return;
    const state = this.getLobbyState();
    this.callbacks.onLobby(state);
    const packet: unknown[] = [
      MSG.LOBBY,
      this.code,
      state.canStart ? 1 : 0,
      0,
      state.players.map((p) => [p.slot, p.name, p.ready ? 1 : 0, p.connected ? 1 : 0]),
      state.arenaId,
    ];
    this.broadcast(packet);
  }

  setInMatch(inMatch: boolean): void {
    this.inMatch = inMatch;
    if (!inMatch) this.emitLobby();
  }

  startMatch(arenaIndex: number): void {
    if (!this.peer || this.inMatch) return;
    this.arenaIndex = ((arenaIndex % ARENAS.length) + ARENAS.length) % ARENAS.length;
    this.inMatch = true;
    this.broadcast([MSG.START, this.arenaIndex]);
  }

  broadcastRematch(): void {
    this.broadcast([MSG.REMATCH]);
  }

  broadcastSnapshot(world: World, fromEvent: number): void {
    if (!this.peer || !this.inMatch) return;
    this.seq++;

    const players: number[][] = [];
    for (let i = 0; i < world.players.length; i++) {
      const p = world.players[i];
      if (!p.active) continue;
      players.push([
        p.slot,
        playerFlags(p),
        round1(p.x),
        round1(p.y),
        round3(p.facing),
        p.hp,
        round1(p.energy),
        p.score,
        round3(p.swingPct),
        p.lockKind === 0 ? -1 : p.lockKind * 100 + p.lockId,
        p.bugKind,
        round1(p.bugCd),
        round1(p.laserCd),
      ]);
    }

    const projectiles: number[][] = [];
    for (let i = 0; i < world.projectiles.length; i++) {
      const pr = world.projectiles[i];
      if (!pr.active) continue;
      projectiles.push([
        pr.serial,
        pr.type,
        pr.owner,
        round1(pr.x),
        round1(pr.y),
        Math.round(pr.vx),
        Math.round(pr.vy),
        pr.radius,
        pr.deflects,
        round2(pr.fuse),
        round2(pr.grace),
        pr.armed ? 1 : 0,
      ]);
    }

    const events: number[][] = [];
    for (let i = fromEvent; i < world.eventCount; i++) {
      const e = world.events[i];
      events.push([e.kind, e.slot, round1(e.x), round1(e.y), round2(e.power), round2(e.dirX), round2(e.dirY)]);
    }

    const packet: unknown[] = [
      MSG.SNAPSHOT,
      this.seq,
      PHASES.indexOf(world.phase),
      round2(world.phaseTimer),
      world.round,
      round1(world.roundTimer),
      world.roundWinner,
      world.matchWinner,
      players,
      projectiles,
      events,
    ];
    this.broadcast(packet);
  }

  expireInputs(now: number): void {
    for (let i = 1; i < this.entries.length; i++) {
      const e = this.entries[i];
      if (!e || !e.connected) continue;
      const f = this.inputs[e.slot];
      if (now - e.lastSeen > NET.inputTimeout * 1000) {
        f.mx = 0;
        f.my = 0;
        f.held = 0;
        f.pressed = 0;
      }
    }
  }

  private accept(conn: DataConnection): void {
    if (this.closed) {
      conn.close();
      return;
    }
    if (this.inMatch) {
      conn.on('open', () => {
        conn.send([MSG.ERROR, 'MATCH IN PROGRESS']);
        window.setTimeout(() => conn.close(), 200);
      });
      return;
    }
    let slot = -1;
    for (let i = 1; i < MAX_PLAYERS; i++) {
      if (!this.entries[i]) {
        slot = i;
        break;
      }
    }
    if (slot < 0) {
      conn.on('open', () => {
        conn.send([MSG.ERROR, 'ROOM FULL']);
        window.setTimeout(() => conn.close(), 200);
      });
      return;
    }

    const entry: HostEntry = {
      slot,
      name: 'GUEST',
      ready: false,
      connected: false,
      conn,
      lastSeen: 0,
      dropped: false,
    };
    this.entries[slot] = entry;

    conn.on('open', () => {
      entry.connected = true;
      entry.lastSeen = performance.now();
      conn.send([MSG.HELLO, slot]);
      this.emitLobby();
    });
    conn.on('data', (data) => this.handleData(entry, data));
    conn.on('close', () => this.dropEntry(entry));
    conn.on('error', () => this.dropEntry(entry));
  }

  private handleData(entry: HostEntry, data: unknown): void {
    if (entry.dropped || !Array.isArray(data)) return;
    const type = data[0];
    if (type === MSG.PROFILE) {
      entry.name = sanitizeName(String(data[1] ?? 'GUEST'));
      entry.ready = !!data[2];
      this.emitLobby();
      return;
    }
    if (type === MSG.INPUT && this.inMatch) {
      const f = this.inputs[entry.slot];
      const held = Number(data[2]) | 0;
      const pressed = Number(data[3]) | 0;
      const mx = Number(data[4]);
      const my = Number(data[5]);
      f.held = held & 31;
      f.pressed |= pressed & 31;
      f.mx = Number.isFinite(mx) ? Math.max(-1, Math.min(1, mx)) : 0;
      f.my = Number.isFinite(my) ? Math.max(-1, Math.min(1, my)) : 0;
      entry.lastSeen = performance.now();
    }
  }

  private dropEntry(entry: HostEntry): void {
    if (entry.dropped) return;
    entry.dropped = true;
    entry.connected = false;
    if (this.entries[entry.slot] === entry) this.entries[entry.slot] = null;
    const f = this.inputs[entry.slot];
    f.mx = 0;
    f.my = 0;
    f.held = 0;
    f.pressed = 0;
    this.callbacks.onGuestLeft(entry.slot, entry.name);
    if (!this.closed && !this.inMatch) this.emitLobby();
  }

  private broadcast(packet: unknown): void {
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      if (!e || !e.connected || !e.conn) continue;
      try {
        e.conn.send(packet);
      } catch (err) {
        console.warn('[DEFLECT-NET] Send failed to slot', e.slot, err);
      }
    }
  }

  close(): void {
    this.closed = true;
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    for (const e of this.entries) if (e?.conn) e.conn.close();
  }
}

export interface GuestCallbacks {
  onLobby: (state: LobbyState) => void;
  onJoined: (slot: number) => void;
  onStart: (arenaId: number) => void;
  onSnapshot: (snapshot: Snapshot) => void;
  onRematch: () => void;
  onClosed: (reason: string) => void;
  onError: (message: string) => void;
}

export interface Snapshot {
  seq: number;
  phase: Phase;
  phaseTimer: number;
  round: number;
  roundTimer: number;
  roundWinner: number;
  matchWinner: number;
  players: number[][];
  projectiles: number[][];
  events: GameEvent[];
  time: number;
}

export class GuestNet {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private timeout: number | null = null;
  private inputSeq = 0;
  private closed = false;
  private joined = false;
  slot = -1;
  ready = false;

  constructor(
    private name: string,
    private callbacks: GuestCallbacks,
  ) {}

  connect(code: string): void {
    this.code = code.toUpperCase();
    openPeer()
      .then((peer) => {
        if (this.closed) {
          peer.destroy();
          return;
        }
        this.peer = peer;
        peer.on('error', (err) => this.onPeerError(err));
        const conn = peer.connect(peerId(this.code), { serialization: 'binary' });
        this.conn = conn;
        conn.on('open', () => {
          console.log('[DEFLECT-NET] Connected to room', this.code);
          this.sendProfile();
        });
        conn.on('data', (data) => this.handleData(data));
        conn.on('close', () => this.fail('HOST CLOSED THE ROOM', false));
        conn.on('error', () => this.fail('CONNECTION ERROR', false));
        this.timeout = window.setTimeout(() => {
          if (!this.joined) this.fail('ROOM NOT FOUND OR NOT RESPONDING', true);
        }, 9000);
      })
      .catch((err) => {
        console.warn('[DEFLECT-NET] Guest peer failed:', err);
        this.callbacks.onError('COULD NOT REACH THE NETWORK');
      });
  }

  private code = '';

  setReady(ready: boolean): void {
    this.ready = ready;
    this.sendProfile();
  }

  sendProfile(): void {
    if (this.conn?.open) this.conn.send([MSG.PROFILE, this.name, this.ready ? 1 : 0]);
  }

  sendInput(frame: InputFrame): void {
    const conn = this.conn;
    if (!conn?.open) return;
    this.inputSeq = (this.inputSeq + 1) & 0xffffff;
    try {
      conn.send([
        MSG.INPUT,
        this.inputSeq,
        frame.held & 31,
        frame.pressed & 31,
        round3(frame.mx),
        round3(frame.my),
      ]);
    } catch {
      /* transient send failures are handled by the close handler */
    }
  }

  private handleData(data: unknown): void {
    if (!Array.isArray(data)) return;
    switch (data[0]) {
      case MSG.HELLO: {
        this.slot = Number(data[1]) | 0;
        this.joined = true;
        if (this.timeout !== null) {
          window.clearTimeout(this.timeout);
          this.timeout = null;
        }
        this.callbacks.onJoined(this.slot);
        console.log('[DEFLECT-NET] Joined as slot', this.slot);
        break;
      }
      case MSG.LOBBY: {
        this.callbacks.onLobby(parseLobby(data));
        break;
      }
      case MSG.START: {
        this.callbacks.onStart(Number(data[1]) | 0);
        break;
      }
      case MSG.REMATCH: {
        this.callbacks.onRematch();
        break;
      }
      case MSG.SNAPSHOT: {
        const snap = parseSnapshot(data);
        if (snap) this.callbacks.onSnapshot(snap);
        break;
      }
      case MSG.ERROR: {
        this.fail(String(data[1] ?? 'ROOM REFUSED'), true);
        break;
      }
      default:
        break;
    }
  }

  private onPeerError(err: Error): void {
    const type = (err as { type?: string }).type;
    console.warn('[DEFLECT-NET] Guest peer error:', type, err.message);
    if (type === 'peer-unavailable') this.fail('ROOM NOT FOUND', true);
    else if (type === 'network' || type === 'server-error' || type === 'socket-error') {
      this.fail('NETWORK UNSTABLE', true);
    }
  }

  private fail(message: string, teardown: boolean): void {
    if (this.closed) return;
    this.closed = true;
    if (this.timeout !== null) window.clearTimeout(this.timeout);
    this.timeout = null;
    if (teardown) {
      this.conn?.close();
      this.peer?.destroy();
    }
    if (!this.joined) this.callbacks.onError(message);
    else this.callbacks.onClosed(message);
  }

  close(): void {
    this.closed = true;
    if (this.timeout !== null) window.clearTimeout(this.timeout);
    this.conn?.close();
    this.peer?.destroy();
    this.conn = null;
    this.peer = null;
  }
}

export function parseLobby(data: unknown[]): LobbyState {
  const players: LobbyPlayer[] = [];
  const rawPlayers = Array.isArray(data[4]) ? (data[4] as unknown[]) : [];
  for (const raw of rawPlayers) {
    if (!Array.isArray(raw)) continue;
    players.push({
      slot: Number(raw[0]) | 0,
      name: sanitizeName(String(raw[1] ?? 'GUEST')),
      ready: !!raw[2],
      connected: !!raw[3],
    });
  }
  return {
    code: String(data[1] ?? ''),
    hostSlot: Number(data[3]) | 0,
    canStart: !!data[2],
    players,
    arenaId: Number(data[5]) | 0,
  };
}

export function parseSnapshot(data: unknown[]): Snapshot | null {
  if (!Array.isArray(data[8]) || !Array.isArray(data[9])) return null;
  const phaseIndex = Number(data[2]) | 0;
  const events: GameEvent[] = [];
  if (Array.isArray(data[10])) {
    for (const raw of data[10] as unknown[]) {
      if (!Array.isArray(raw)) continue;
      events.push({
        kind: Number(raw[0]) | 0,
        slot: Number(raw[1]) | 0,
        x: Number(raw[2]) || 0,
        y: Number(raw[3]) || 0,
        power: Number(raw[4]) || 0,
        dirX: Number(raw[5]) || 0,
        dirY: Number(raw[6]) || 0,
      });
    }
  }
  return {
    seq: Number(data[1]) | 0,
    phase: PHASES[phaseIndex] ?? 'countdown',
    phaseTimer: Number(data[3]) || 0,
    round: Number(data[4]) | 0,
    roundTimer: Number(data[5]) || 0,
    roundWinner: Number(data[6]) | 0,
    matchWinner: Number(data[7]) | 0,
    players: (data[8] as number[][]).filter((p) => Array.isArray(p)),
    projectiles: (data[9] as number[][]).filter((p) => Array.isArray(p)),
    events,
    time: performance.now() / 1000,
  };
}

// --- Guest view ---------------------------------------------------------------------------

export class NetView {
  mode = 'match' as const;
  readonly arena: ArenaDef;
  phase: Phase = 'countdown';
  phaseTimer = 0;
  round = 1;
  roundTimer = 0;
  roundWinner = -1;
  matchWinner = -1;
  localSlot: number;
  names: string[] = [];
  readonly players: Player[];
  readonly projectiles: Projectile[];
  readonly drone = null;

  readonly predictor: LocalPredictor;
  private snaps: (Snapshot | null)[] = [null, null, null, null];
  private snapWrite = 0;
  private snapCount = 0;
  private stamp = 0;
  private projStamp = new Int32Array(MAX_PROJECTILES);

  constructor(localSlot: number, arena: ArenaDef = ARENAS[0]) {
    this.localSlot = localSlot;
    this.arena = arena;
    this.players = new Array(MAX_PLAYERS);
    for (let i = 0; i < MAX_PLAYERS; i++) this.players[i] = createPlayer(i);
    this.projectiles = new Array(MAX_PROJECTILES);
    for (let i = 0; i < MAX_PROJECTILES; i++) this.projectiles[i] = createProjectile();
    this.predictor = new LocalPredictor(localSlot, arena);
  }

  pushSnapshot(snap: Snapshot): void {
    this.snaps[this.snapWrite] = snap;
    this.snapWrite = (this.snapWrite + 1) % this.snaps.length;
    this.snapCount = Math.min(this.snaps.length, this.snapCount + 1);
    this.phase = snap.phase;
    this.phaseTimer = snap.phaseTimer;
    this.round = snap.round;
    this.roundTimer = snap.roundTimer;
    this.roundWinner = snap.roundWinner;
    this.matchWinner = snap.matchWinner;

    let local: number[] | null = null;
    for (let i = 0; i < snap.players.length; i++) {
      if ((snap.players[i][0] | 0) === this.localSlot) {
        local = snap.players[i];
        break;
      }
    }
    if (local) this.predictor.adopt(local);
    else this.predictor.setInactive();
  }

  resetPrediction(): void {
    this.predictor.reset();
    this.phase = 'countdown';
    this.phaseTimer = 0;
    this.round = 1;
    this.roundTimer = 0;
    this.roundWinner = -1;
    this.matchWinner = -1;
    this.snapCount = 0;
    this.snapWrite = 0;
    this.snaps[0] = this.snaps[1] = this.snaps[2] = this.snaps[3] = null;
    for (let i = 0; i < this.players.length; i++) this.players[i].active = false;
    for (let i = 0; i < this.projectiles.length; i++) {
      this.projectiles[i].active = false;
      this.projectiles[i].trailCount = 0;
    }
  }

  /** Fills the reusable view objects for the current render frame. */
  present(): void {
    const latest = this.newest();
    if (!latest) return;

    const now = performance.now() / 1000;
    const renderTime = now - NET.interpDelay;
    const pair = this.findPair(renderTime);
    const a = pair.a;
    const b = pair.b;
    const alpha = pair.alpha;

    this.phase = b.phase;
    this.phaseTimer = b.phaseTimer;
    this.round = b.round;
    this.roundTimer = b.roundTimer;
    this.roundWinner = b.roundWinner;
    this.matchWinner = b.matchWinner;

    for (let i = 0; i < this.players.length; i++) this.players[i].active = false;

    for (let i = 0; i < b.players.length; i++) {
      const raw = b.players[i];
      const slot = raw[0] | 0;
      if (slot < 0 || slot >= this.players.length) continue;
      const view = this.players[slot];
      const old = a ? findPlayer(a.players, slot) : null;
      view.active = true;
      view.connected = true;
      view.name = this.names[slot] ?? `P${slot + 1}`;
      view.slot = slot;
      view.x = old ? raw[2] + (old[2] - raw[2]) * (1 - alpha) : raw[2];
      view.y = old ? raw[3] + (old[3] - raw[3]) * (1 - alpha) : raw[3];
      view.prevX = view.x;
      view.prevY = view.y;
      view.facing = old ? lerpAngle(old[4], raw[4], alpha) : raw[4];
      view.prevFacing = view.facing;
      view.hp = raw[5];
      view.energy = raw[6];
      view.score = raw[7];
      view.swingPct = raw[8] ?? 0;
      const flags = raw[1] | 0;
      view.alive = (flags & PF.ALIVE) !== 0;
      view.iframes = (flags & PF.INVULN) !== 0 ? 0.02 : 0;
      view.swingPhase = (flags & PF.SWING_STARTUP) !== 0 ? 1 : (flags & PF.SWING_ACTIVE) !== 0 ? 2 : (flags & (PF.SWING_HIT | PF.SWING_RECOVERY)) !== 0 ? 3 : 0;
      view.swingHit = (flags & PF.SWING_HIT) !== 0;
      view.swingDir = (flags & PF.SWING_REVERSE) !== 0 ? -1 : 1;
      view.waveT = (flags & PF.WAVE) !== 0 ? 0.2 : 0;
      view.chargeT = (flags & PF.CHARGE_READY) !== 0 ? PLAYER.waveHoldTime : 0;
      const lockCode = raw[9] ?? -1;
      view.lockActive = (flags & PF.LOCKED) !== 0;
      if (lockCode >= 100) {
        view.lockKind = Math.floor(lockCode / 100);
        view.lockId = lockCode % 100;
      } else {
        view.lockKind = 0;
        view.lockId = -1;
      }
      view.dashKind = (flags & PF.CHARGE_DASHING) !== 0 ? 1 : 0;
      view.dashT = (flags & PF.DASHING) !== 0 ? (view.dashKind === 1 ? 0.2 : 0.05) : 0;
      view.laserChargeHeld = (flags & PF.LASER_CHARGING) !== 0;
      view.laserChargeT = view.laserChargeHeld ? PLAYER.laserChargeTime : 0;
      view.laserT = (flags & PF.LASER_FIRING) !== 0 ? PLAYER.laserDuration : 0;
      view.laserFacing = view.facing;
      view.bugKind = raw[10] ?? 0;
      view.bugCd = raw[11] ?? 0;
      view.laserCd = raw[12] ?? 0;
      view.ghostT = (flags & PF.GHOST) !== 0 ? 0.2 : 0;
      view.wallT = (flags & PF.WALL) !== 0 ? 0.2 : 0;
      view.slowT = (flags & PF.SLOW) !== 0 ? 0.2 : 0;
      view.guardT = (flags & PF.GUARD) !== 0 ? 0.2 : 0;
      view.guardCd = 0;
      view.hitFlash = 0;
    }

    // Local player: predicted kinematics, authoritative stats.
    const lp = this.predictor.p;
    if (lp.active) {
      const view = this.players[this.localSlot];
      if (view.active) {
        view.x = lp.x;
        view.y = lp.y;
        view.prevX = lp.prevX;
        view.prevY = lp.prevY;
        if (!view.lockActive) {
          view.facing = lp.facing;
          view.prevFacing = lp.prevFacing;
        }
        view.swingPhase = lp.swingPhase;
        view.swingPct = lp.swingPct;
        view.swingFacing = lp.swingFacing;
        view.swingDir = lp.swingDir;
        view.swingHit = lp.swingHit;
        view.chargeT = lp.chargeT;
        view.waveT = lp.waveT;
        view.alive = lp.alive;
        view.hp = lp.hp;
        view.energy = lp.energy;
        view.score = lp.score;
        view.iframes = lp.iframes;
        view.hitFlash = lp.hitFlash;
        view.dashCd = lp.dashCd;
        view.dashCharges = lp.dashCharges;
        view.dashT = lp.dashT;
        view.dashKind = lp.dashKind;
        view.guardT = lp.guardT;
        view.guardCd = lp.guardCd;
      }
    }

    // Projectiles, matched by serial so trails survive snapshot reordering.
    this.stamp++;
    for (let i = 0; i < b.projectiles.length; i++) {
      const raw = b.projectiles[i];
      const serial = raw[0] | 0;
      let index = -1;
      for (let k = 0; k < this.projectiles.length; k++) {
        const view = this.projectiles[k];
        if (view.active && view.serial === serial) {
          index = k;
          break;
        }
      }
      if (index < 0) {
        for (let k = 0; k < this.projectiles.length; k++) {
          if (!this.projectiles[k].active) {
            index = k;
            break;
          }
        }
      }
      if (index < 0) continue;
      const view = this.projectiles[index];
      if (view.serial !== serial) {
        view.trailCount = 0;
        view.trailHead = 0;
      }
      const old = a ? findProjectile(a.projectiles, serial) : null;
      view.active = true;
      view.serial = serial;
      view.type = (raw[1] as 0 | 1 | 2) ?? 0;
      view.owner = raw[2] | 0;
      view.x = old ? raw[3] + (old[3] - raw[3]) * (1 - alpha) : raw[3];
      view.y = old ? raw[4] + (old[4] - raw[4]) * (1 - alpha) : raw[4];
      view.prevX = view.x;
      view.prevY = view.y;
      view.vx = raw[5];
      view.vy = raw[6];
      view.radius = raw[7];
      view.deflects = raw[8] | 0;
      view.damage = 1 + view.deflects;
      view.fuse = raw[9];
      view.grace = raw[10];
      view.armed = !!raw[11];
      view.bounces = 0;
      this.projStamp[index] = this.stamp;
    }
    for (let i = 0; i < this.projectiles.length; i++) {
      const view = this.projectiles[i];
      if (view.active && this.projStamp[i] !== this.stamp) {
        view.active = false;
        view.trailCount = 0;
      }
    }
  }

  predictStep(input: InputFrame, dt: number): void {
    this.predictor.step(input, dt);
  }

  private newest(): Snapshot | null {
    if (this.snapCount === 0) return null;
    return this.snaps[(this.snapWrite - 1 + this.snaps.length) % this.snaps.length];
  }

  private findPair(renderTime: number): { a: Snapshot | null; b: Snapshot; alpha: number } {
    const count = this.snapCount;
    let a: Snapshot | null = null;
    let b: Snapshot | null = null;
    for (let i = 0; i < count; i++) {
      const idx = (this.snapWrite - count + i + this.snaps.length) % this.snaps.length;
      const s = this.snaps[idx];
      if (!s) continue;
      if (s.time <= renderTime) a = s;
      if (s.time >= renderTime && !b) b = s;
    }
    if (!b) b = this.newest();
    if (!b) throw new Error('No snapshot');
    if (!a) a = b;
    const span = b.time - a.time;
    const alpha = span > 0.0001 ? Math.max(0, Math.min(1, (renderTime - a.time) / span)) : 1;
    return { a, b, alpha };
  }
}

function findPlayer(players: number[][], slot: number): number[] | null {
  for (let i = 0; i < players.length; i++) if ((players[i][0] | 0) === slot) return players[i];
  return null;
}

function findProjectile(projectiles: number[][], serial: number): number[] | null {
  for (let i = 0; i < projectiles.length; i++) if ((projectiles[i][0] | 0) === serial) return projectiles[i];
  return null;
}

function lerpAngle(a: number, b: number, t: number): number {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
}

// --- Local prediction ---------------------------------------------------------------------

export class LocalPredictor {
  readonly p: Player;
  initialized = false;
  private authX = 0;
  private authY = 0;
  private authFacing = 0;

  constructor(
    slot: number,
    private arena: ArenaDef,
  ) {
    this.p = createPlayer(slot);
    this.p.active = true;
    this.p.connected = true;
  }

  adopt(raw: number[]): void {
    const flags = raw[1] | 0;
    const authX = raw[2];
    const authY = raw[3];
    const wasAlive = this.p.alive;
    this.authX = authX;
    this.authY = authY;
    this.authFacing = raw[4];
    this.p.active = true;
    this.p.alive = (flags & PF.ALIVE) !== 0;
    this.p.hp = raw[5];
    this.p.energy = raw[6];
    this.p.score = raw[7];
    this.p.swingDir = (flags & PF.SWING_REVERSE) !== 0 ? -1 : 1;
    this.p.swingHit = (flags & PF.SWING_HIT) !== 0;
    if ((flags & PF.WAVE) !== 0) this.p.waveT = Math.max(this.p.waveT, 0.05);
    if ((flags & PF.CHARGE_DASHING) !== 0) this.p.dashKind = 1;
    this.p.laserChargeHeld = (flags & PF.LASER_CHARGING) !== 0;
    this.p.laserChargeT = this.p.laserChargeHeld ? PLAYER.laserChargeTime : 0;
    this.p.laserT = (flags & PF.LASER_FIRING) !== 0 ? PLAYER.laserDuration : 0;
    this.p.laserFacing = raw[4];
    this.p.bugKind = raw[10] ?? this.p.bugKind;
    this.p.bugCd = raw[11] ?? 0;
    this.p.laserCd = raw[12] ?? 0;
    this.p.ghostT = (flags & PF.GHOST) !== 0 ? 0.2 : 0;
    this.p.wallT = (flags & PF.WALL) !== 0 ? 0.2 : 0;
    this.p.slowT = (flags & PF.SLOW) !== 0 ? 0.2 : 0;
    this.p.guardT = (flags & PF.GUARD) !== 0 ? 0.2 : 0;

    if (!this.initialized || (!wasAlive && this.p.alive)) {
      this.p.x = authX;
      this.p.y = authY;
      this.p.prevX = authX;
      this.p.prevY = authY;
      this.p.facing = raw[4];
      this.p.prevFacing = raw[4];
      this.initialized = true;
      return;
    }
    if (!this.p.alive) {
      this.initialized = true;
      return;
    }

    const dx = this.p.x - authX;
    const dy = this.p.y - authY;
    const d2 = dx * dx + dy * dy;
    if (d2 > 220 * 220) {
      this.p.x = authX;
      this.p.y = authY;
      this.p.vx = 0;
      this.p.vy = 0;
      this.p.x = this.p.prevX = authX;
      this.p.y = this.p.prevY = authY;
    }
    this.initialized = true;
    this.p.iframes = Math.max(this.p.iframes, (flags & PF.INVULN) !== 0 ? 0.02 : 0);
  }

  reset(): void {
    this.initialized = false;
    this.p.active = false;
    this.p.alive = false;
    this.p.swingPhase = 0;
    this.p.swingT = 0;
    this.p.chargeT = 0;
    this.p.chargeHeld = false;
    this.p.waveT = 0;
    this.p.waveCd = 0;
    this.p.comboStage = 0;
    this.p.comboT = 0;
    this.p.dashT = 0;
    this.p.dashCd = 0;
    this.p.dashCharges = PLAYER.dashCharges;
    this.p.dashKind = 0;
    this.p.guardT = 0;
    this.p.guardCd = 0;
    this.p.dashChargeT = 0;
    this.p.dashChargeHeld = false;
    this.p.chargeDashCd = 0;
    this.p.laserChargeHeld = false;
    this.p.ghostT = 0;
    this.p.wallT = 0;
    this.p.slowT = 0;
    this.p.bugCd = 0;
    this.p.laserChargeT = 0;
    this.p.laserT = 0;
    this.p.laserCd = 0;
  }

  setInactive(): void {
    this.p.active = false;
  }

  step(input: InputFrame, dt: number): void {
    const p = this.p;
    if (!this.initialized || !p.active || !p.alive) return;

    p.prevX = p.x;
    p.prevY = p.y;
    p.prevFacing = p.facing;
    if (p.dashT > 0) p.dashT = Math.max(0, p.dashT - dt);
    if (p.dashCd > 0) {
      p.dashCd = Math.max(0, p.dashCd - dt);
      if (p.dashCd === 0 && p.dashCharges < PLAYER.dashCharges) {
        p.dashCharges++;
        if (p.dashCharges < PLAYER.dashCharges) p.dashCd = PLAYER.dashCooldown;
      }
    }
    if (p.guardCd > 0) p.guardCd = Math.max(0, p.guardCd - dt);
    if (p.chargeDashCd > 0) p.chargeDashCd = Math.max(0, p.chargeDashCd - dt);
    if (p.iframes > 0) p.iframes = Math.max(0, p.iframes - dt);
    if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt);
    if (p.waveT > 0) p.waveT = Math.max(0, p.waveT - dt);
    if (p.waveCd > 0) p.waveCd = Math.max(0, p.waveCd - dt);
    if (p.comboT > 0) {
      p.comboT = Math.max(0, p.comboT - dt);
      if (p.comboT === 0) p.comboStage = 0;
    }
    if (p.laserT > 0) {
      p.laserT = Math.max(0, p.laserT - dt);
      if (p.laserT === 0) p.laserCd = PLAYER.laserCooldown;
    }

    // The charged beam is host-authoritative. Freeze local prediction while the
    // snapshot says it is charging or firing; the host supplies facing and damage.
    if (p.laserChargeHeld || p.laserT > 0) {
      p.facing = this.authFacing;
      p.laserFacing = this.authFacing;
      stepPlayerMotion(p, 0, 0, dt, this.arena.pillars, this.arena.bounds);
      const adx = this.authX - p.x;
      const ady = this.authY - p.y;
      const ad2 = adx * adx + ady * ady;
      if (ad2 > 40 * 40) {
        const k = ad2 > 90 * 90 ? 0.2 : 0.05;
        p.x += adx * k;
        p.y += ady * k;
      }
      return;
    }

    // Swings and recovery locally; hits stay authoritative.
    if (p.swingPhase === 1) {
      p.swingT -= dt;
      p.swingPct = Math.max(0, p.swingT / PLAYER.swingStartup);
      if (p.swingT <= 0) {
        p.swingPhase = 2;
        p.swingT = PLAYER.swingActive;
        p.swingPct = 1;
      }
    } else if (p.swingPhase === 2) {
      p.swingT -= dt;
      p.swingPct = Math.max(0, p.swingT / PLAYER.swingActive);
      if (p.swingT <= 0) {
        p.swingPhase = 3;
        p.swingT = p.swingHit ? PLAYER.swingHitRecovery : PLAYER.swingWhiffRecovery;
        p.swingPct = 1;
      }
    } else if (p.swingPhase === 3) {
      p.swingT -= dt;
      p.swingPct = Math.max(0, p.swingT / (p.swingHit ? PLAYER.swingHitRecovery : PLAYER.swingWhiffRecovery));
      if (p.swingT <= 0) {
        p.swingPhase = 0;
        p.swingT = 0;
        p.swingPct = 0;
      }
    }

    const moveSq = input.mx * input.mx + input.my * input.my;
    if (moveSq > 0.0025) {
      p.moveDirX = input.mx;
      p.moveDirY = input.my;
    }
    if (moveSq > 0.0025 && p.swingPhase === 0 && p.dashT <= 0) {
      p.facing = Math.atan2(input.my, input.mx);
    }
    const heldDash = (input.held & ACTION.DASH) !== 0;
    if (input.pressed & ACTION.DASH) {
      p.dashChargeT = 0;
      if (p.dashT <= 0 && p.dashCharges > 0 && p.swingPhase === 0) {
        const dir = Math.atan2(p.moveDirY, p.moveDirX);
        p.dashT = PLAYER.dashTime;
        if (p.dashCd <= 0) p.dashCd = PLAYER.dashCooldown;
        p.dashCharges--;
        p.dashKind = 0;
        p.dashDirX = Math.cos(dir);
        p.dashDirY = Math.sin(dir);
        p.iframes = Math.max(p.iframes, PLAYER.dashIframes);
      }
    }
    if (heldDash) p.dashChargeT += dt;
    else {
      if (
        p.dashChargeHeld &&
        p.dashChargeT >= PLAYER.dashChargeTime &&
        p.chargeDashCd <= 0 &&
        p.dashT <= 0 &&
        p.swingPhase === 0
      ) {
        const dir = Math.atan2(p.moveDirY, p.moveDirX);
        p.dashT = PLAYER.chargeDashTime;
        if (p.dashCd <= 0) p.dashCd = PLAYER.dashCooldown;
        p.dashCharges = Math.max(0, p.dashCharges - 1);
        p.chargeDashCd = PLAYER.chargeDashCooldown;
        p.dashKind = 1;
        p.dashDirX = Math.cos(dir);
        p.dashDirY = Math.sin(dir);
        p.iframes = Math.max(p.iframes, PLAYER.chargeDashIframes);
      }
      p.dashChargeT = 0;
    }
    p.dashChargeHeld = heldDash;
    const heldSwing = (input.held & ACTION.SWING) !== 0;
    if (input.pressed & ACTION.SWING) {
      p.chargeT = 0;
      if (p.comboStage === 2 && p.comboT > 0) {
        if (p.waveCd <= 0 && p.swingPhase === 0 && p.waveT <= 0) {
          p.waveT = PLAYER.waveVisualTime;
          p.waveCd = PLAYER.waveCooldown;
          p.comboStage = 0;
          p.comboT = 0;
        }
      } else {
        const dir = p.comboStage === 1 && p.comboT > 0 ? -1 : 1;
        if (p.swingPhase === 0 && p.dashT <= 0 && p.waveT <= 0) {
          p.swingPhase = 1;
          p.swingT = PLAYER.swingStartup;
          p.swingPct = 1;
          p.swingHit = false;
          p.swingFacing = p.facing;
          p.swingDir = dir;
          p.comboStage = dir === -1 ? 2 : 1;
          p.comboT = PLAYER.comboWindow;
        }
      }
    }
    if (heldSwing) {
      p.chargeT += dt;
      if (p.guardT <= 0 && p.guardCd <= 0 && p.chargeT >= PLAYER.guardStartDelay) {
        p.guardT = PLAYER.guardDuration;
      }
      if (p.guardT > 0) {
        p.guardT = Math.max(0, p.guardT - dt);
        if (p.guardT === 0) p.guardCd = PLAYER.guardCooldown;
      }
    } else {
      if (p.guardT > 0) {
        p.guardT = 0;
        p.guardCd = Math.max(p.guardCd, PLAYER.guardReleaseCooldown);
      }
      p.chargeT = 0;
    }
    p.chargeHeld = heldSwing;

    stepPlayerMotion(p, input.mx, input.my, dt, this.arena.pillars, this.arena.bounds);

    if (moveSq <= 0.0025 && p.swingPhase === 0 && p.dashT <= 0) {
      p.facing = this.authFacing;
    }

    // Keep the local body near the authoritative one, but never fight an in-flight dash.
    if (p.dashT <= 0) {
      const dx = this.authX - p.x;
      const dy = this.authY - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 40 * 40) {
        const k = d2 > 90 * 90 ? 0.2 : 0.05;
        p.x += dx * k;
        p.y += dy * k;
      }
    }
  }
}
