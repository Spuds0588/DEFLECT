import {
  ARENAS,
  PLUG_STATE,
  plugCycle,
  plugPhaseAt,
} from '../src/game/arenas';
import { PLAYER, SIM_DT } from '../src/game/config';
import { SRC } from '../src/game/types';
import { World } from '../src/game/world';
import { buildSnapshotHazards } from '../src/net/net';

if (ARENAS.length !== 27) throw new Error(`expected 27 arenas, got ${ARENAS.length}`);
const arena = ARENAS[26];
if (arena.id !== 26 || arena.name !== 'SMART PLUG') throw new Error('SMART PLUG is not arena 26');
const plug = arena.plug;
if (!plug) throw new Error('SMART PLUG has no circuit layout');
if (arena.pillars.length !== 4) throw new Error('expected four plug modules');
if (plug.arcs.length !== 4) throw new Error('expected four socket-to-socket arcs');

const cycle = plugCycle(plug);
const phases = new Set<number>();
for (let t = 0; t <= cycle + 0.1; t += 0.01) phases.add(plugPhaseAt(plug, t));
if (phases.size !== 4) throw new Error(`expected all four plug phases, got ${[...phases].join(',')}`);
if (plugPhaseAt(plug, 0) !== PLUG_STATE.safe) throw new Error('plug did not start green');
if (plugPhaseAt(plug, plug.safe + plug.warn * 0.5) !== PLUG_STATE.warn) throw new Error('warning phase missing');
if (plugPhaseAt(plug, plug.safe + plug.warn + plug.live * 0.5) !== PLUG_STATE.live) throw new Error('live phase missing');
if (plugPhaseAt(plug, cycle - plug.cool * 0.5) !== PLUG_STATE.cool) throw new Error('cooldown phase missing');

function arcDistance(ax: number, ay: number, bx: number, by: number, x: number, y: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0.0001 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
  const px = ax + dx * t;
  const py = ay + dy * t;
  return Math.hypot(x - px, y - py);
}
const clearance = plug.arcWidth * 0.5 + PLAYER.radius;
for (let i = 0; i < arena.spawns.length; i++) {
  const spawn = arena.spawns[i];
  for (let a = 0; a < plug.arcs.length; a++) {
    const arc = plug.arcs[a];
    if (arcDistance(arc.ax, arc.ay, arc.bx, arc.by, spawn.x, spawn.y) < clearance) {
      throw new Error(`spawn ${i} starts inside circuit arc ${a}`);
    }
  }
}

const world = new World('training', ['SMART PLUG'], 0, arena);
world.drone.active = false;
world.drone.respawnT = 1e9;
const player = world.players[0];
const arc = plug.arcs[0];
player.x = (arc.ax + arc.bx) * 0.5;
player.y = (arc.ay + arc.by) * 0.5;
player.prevX = player.x;
player.prevY = player.y;
player.iframes = 0;
const hp = player.hp;
let t = 0;
while (t < 3.05) {
  world.step(SIM_DT, [null]);
  t += SIM_DT;
}
if (player.hp !== hp) throw new Error('green phase damaged a body before the red pulse');
while (t < 4.2 && player.hp === hp) {
  world.step(SIM_DT, [null]);
  t += SIM_DT;
}
if (player.hp !== hp - 1) throw new Error(`expected one circuit hit, hp ${player.hp} from ${hp}`);
if (player.killerKind !== SRC.PLUG) throw new Error(`expected SRC.PLUG ${SRC.PLUG}, got ${player.killerKind}`);
const hazardDamage = hp - player.hp;
const hitHp = player.hp;
for (let j = 0; j < 0.7; j += SIM_DT) world.step(SIM_DT, [null]);
if (player.hp !== hitHp) throw new Error('a second arc hit landed during the same red pulse');
if (buildSnapshotHazards(world) !== null) throw new Error('plug state leaked into SnapshotHazards');

world.beginRound();
if (world.plugT !== 0 || world.plugPhase !== PLUG_STATE.safe) throw new Error('round reset did not rearm the green phase');
if (buildSnapshotHazards(world) !== null) throw new Error('reset leaked plug state into SnapshotHazards');

console.log(
  JSON.stringify({
    arenas: ARENAS.length,
    plugId: arena.id,
    arcs: plug.arcs.length,
    cycle: Number(cycle.toFixed(2)),
    hitAt: Number(t.toFixed(2)),
    hazardDamage,
    hazards: buildSnapshotHazards(world) === null ? 0 : 1,
  }),
);
