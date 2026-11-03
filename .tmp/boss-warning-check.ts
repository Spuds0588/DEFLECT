/**
 * The mini-boss announcement: Kitty warns, the card names it, the body waits out the
 * warning and then arrives. This is a presentation check, so the pilot is held invulnerable
 * (like campaign2-check); it says nothing about surviving the fight.
 */
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
import { MAX_PLAYERS, SIM_DT } from '../src/game/config';
import { ARENAS } from '../src/game/arenas';
import { World } from '../src/game/world';

const level = PLAYABLE_CAMPAIGN_LEVELS.find((l) => l.boss !== undefined);
if (!level) throw new Error('no campaign level authors a boss');
const arena = ARENAS.find((a) => a.id === level.arenaId);
if (!arena) throw new Error(`arena ${level.arenaId} missing`);

const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'PILOT';
for (let i = 1; i < MAX_PLAYERS; i++) names[i] = `BOT${i}`;
const world = new World('gauntlet', names, 0, arena, false, 0, 3, null, true,
  level.dataCrates, false, level.intro, level.clearKills, false, level.boss ?? -1);
const priv = world as any;
priv.tutorial = null;
priv.campaignPhase = 'assault';
priv.beginAssault();
priv.gauntletKills = world.campaignKillsToClear;

const frames = new Array(MAX_PLAYERS).fill(null).map(() => ({ mx: 0, my: 0, held: 0, pressed: 0 }));
const p = world.players[0];
let ticks = 0;
let warnedAt = -1;
let spawnedAt = -1;
let cardKind = -1;
let lineDroppedEarly = false;
while (ticks++ < Math.round(30 / SIM_DT)) {
  p.iframes = 999;
  world.step(SIM_DT, frames);
  const t = ticks * SIM_DT;
  if (warnedAt < 0 && priv.campaignWarnStep) {
    warnedAt = t;
    cardKind = world.campaignBannerKind;
  }
  if (spawnedAt < 0 && priv.campaignBossSpawned) spawnedAt = t;
  if (warnedAt >= 0 && spawnedAt < 0 && !priv.campaignWarnStep) lineDroppedEarly = true;
}
if (warnedAt < 0) throw new Error('kitty never warned before the boss');
if (cardKind !== 7) throw new Error(`title card kind ${cardKind}, expected 7`);
if (spawnedAt < 0) throw new Error('boss never spawned after the warning');
if (lineDroppedEarly) throw new Error('warning line cleared before the boss arrived');
if (spawnedAt - warnedAt < 4.8) throw new Error(`warning window ${(spawnedAt - warnedAt).toFixed(2)}s, expected ~5s`);
if (priv.campaignWarnStep) throw new Error('warning line still showing after the boss arrived');
const boss = world.worms.find((w: any) => w.active && w.bossKind === level.boss);
if (!boss) throw new Error('announced boss is not live');
console.log(JSON.stringify({ warnedAt: +warnedAt.toFixed(2), spawnedAt: +spawnedAt.toFixed(2), card: cardKind, bossHp: Math.round(boss.hp) }));
console.log('boss-warning-check: OK (kitty line -> title card -> 5s window -> Mega Worm)');
