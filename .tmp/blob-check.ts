/** File blob probe: icon health, shed, shrink, slam, toss glue, chip-out, Ghost phase and kill credit. */
import { BLOB, SIM_DT } from '../src/game/config';
import { MINIBOSS, MINIBOSSES } from '../src/game/minibosses';
import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';
import type { Worm } from '../src/game/types';

const fail = (m: string): never => {
  throw new Error(m);
};
const arena = ARENAS.find((a) => a.id === 22) ?? ARENAS[0];

function fresh(): { world: World; priv: any; blob: Worm } {
  const world = new World('gauntlet', ['BLOB'], 0, arena);
  const priv = world as any;
  for (const w of world.worms) w.active = false;
  for (const v of world.viruses) v.active = false;
  for (const s of world.sentries) s.active = false;
  for (const e of world.errors) e.active = false;
  const p = world.players[0];
  p.x = (arena.bounds.left + arena.bounds.right) * 0.5;
  p.y = (arena.bounds.top + arena.bounds.bottom) * 0.5;
  p.alive = true;
  p.hp = p.maxHp = 12;
  p.iframes = 0;
  p.cloakT = 0;
  p.glueT = 0;
  const blob = priv.spawnMiniboss(MINIBOSS.BLOB, p.x + 300, p.y) as Worm;
  if (!blob || !blob.blob) fail('the blob never spawned');
  blob.spawnT = 0;
  return { world, priv, blob };
}

// --- shape and icon health --------------------------------------------------
{
  const def = MINIBOSSES.find((d) => d.id === MINIBOSS.BLOB) ?? fail('blob missing from the registry');
  if (def.body !== 'blob') fail('the registry lost the blob body flag');
  const { priv, blob } = fresh();
  if (blob.hp !== BLOB.icons || blob.maxHp !== BLOB.icons) fail(`icon pool is ${blob.hp}/${blob.maxHp}`);
  if (Math.abs(blob.hitR - BLOB.rMax) > 1) fail(`blob spawned at radius ${blob.hitR}`);
  if (blob.blob!.nodeR.length !== BLOB.nodes) fail('the rim skeleton has the wrong node count');
  priv.damageWorm(blob, 1, 0, 1, 0, 0);
  if (blob.hp !== BLOB.icons - 1) fail('one damage did not remove exactly one icon');
  if (blob.blob!.shedT <= 0 || blob.blob!.shed < 1) fail('a hit did not queue a shed burst');
  priv.damageWorm(blob, 5, 0, 1, 0, 0);
  if (blob.hp !== BLOB.icons - 6) fail('damage did not scale the icon count');
  console.log(JSON.stringify({ shape: { icons: blob.maxHp, radius: Math.round(blob.hitR), shed: blob.blob!.shed } }));
}

// --- shrink with health -----------------------------------------------------
{
  const { priv, blob } = fresh();
  const r0 = blob.hitR;
  priv.damageWorm(blob, BLOB.icons * 0.5, 0, 1, 0, 0);
  priv.updateWorm(blob, SIM_DT);
  if (!(blob.hitR < r0)) fail('the blob did not shrink as icons came off');
  priv.damageWorm(blob, BLOB.icons, 0, 1, 0, 0);
  if (blob.active) fail('the blob survived losing every icon');
  console.log(JSON.stringify({ shrink: { from: Math.round(r0), to: Math.round(blob.hitR), dead: !blob.active } }));
}

// --- close range: high jump slam --------------------------------------------
{
  const { world, priv, blob } = fresh();
  const p = world.players[0];
  p.x = blob.x + 300;
  p.y = blob.y;
  blob.blob!.cd = 0;
  blob.blob!.state = 0;
  p.hp = 8;
  let sawWindup = false;
  let sawAir = false;
  let sawLanding = false;
  for (let i = 0; i < 300; i++) {
    priv.updateWorm(blob, SIM_DT);
    if (blob.blob!.state === 4) sawWindup = true;
    if (blob.blob!.state === 5) sawAir = true;
    if (blob.blob!.state === 6) sawLanding = true;
  }
  if (!sawWindup || !sawAir || !sawLanding) fail('the close-range slam did not complete its windup/air/landing cycle');
  if (p.hp >= 8) fail('the slam landing did no damage');
  if (p.glueT > 0) fail('the slam incorrectly applied the toss glue');
  console.log(JSON.stringify({ slam: { windup: sawWindup, air: sawAir, landing: sawLanding, hp: p.hp } }));
}

// --- toss, glue and chip-out ------------------------------------------------
{
  const { world, priv, blob } = fresh();
  const p = world.players[0];
  p.x = blob.x + BLOB.slam.range + 50;
  p.y = blob.y;
  blob.blob!.cd = 0;
  blob.blob!.state = 0;
  p.hp = 8;
  let landed = false;
  for (let i = 0; i < 300 && !landed; i++) {
    priv.updateWorm(blob, SIM_DT);
    if (blob.blob!.state === 3) landed = true;
  }
  if (!landed) fail('the glob was never thrown');
  if (p.glueT <= 0) fail('a glob landing did not glue the player');
  if (p.glueHits !== BLOB.glueHits) fail(`the cage needs ${p.glueHits} hits instead of ${BLOB.glueHits}`);
  if (p.hp >= 8) fail('the glob landing did no damage');
  const fired = priv.spawnProjectile(p, 0, 1, 100, false, 5);
  if (fired) fail('a glued player could still shoot');
  if (p.glueHits !== BLOB.glueHits - 1) fail('shooting did not tear a file off the cage');
  priv.trySwing(p, 1, 1);
  if (p.glueHits !== BLOB.glueHits - 2) fail('melee did not tear a file off the cage');
  priv.spawnProjectile(p, 0, 1, 100, false, 5);
  if (p.glueT > 0 || p.glueHits > 0) fail('three presses did not free the player');
  console.log(JSON.stringify({ glue: { hits: BLOB.glueHits, freed: p.glueT === 0 } }));
}

// --- Ghost phases out -------------------------------------------------------
{
  const { world, priv, blob } = fresh();
  const p = world.players[0];
  p.glueT = BLOB.glueTime;
  p.glueHits = BLOB.glueHits;
  p.cloakT = 1;
  priv.updateWorm(blob, SIM_DT);
  if (p.glueT > 0) fail("Ghost's cloak did not phase the body out of the cage");
  console.log(JSON.stringify({ phase: true }));
}

// --- bosses may overhang the arena edge -------------------------------------
{
  const { priv, blob } = fresh();
  blob.x = arena.bounds.left + 2;
  blob.y = (arena.bounds.top + arena.bounds.bottom) * 0.5;
  for (let i = 0; i < 4; i++) priv.updateWorm(blob, SIM_DT);
  const pad = blob.hitR * 0.5;
  if (blob.x < arena.bounds.left + pad - 1) fail('the blob was pushed fully inside the arena');
  if (blob.x > arena.bounds.left + blob.hitR) fail('the blob left the arena entirely');
  console.log(JSON.stringify({ overhang: { x: Math.round(blob.x - arena.bounds.left), pad: Math.round(pad) } }));
}

console.log('blob-check: OK');
