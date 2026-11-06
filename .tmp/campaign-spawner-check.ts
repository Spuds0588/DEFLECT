/**
 * Campaign clearability audit:
 *   - every non-boss assault device has at least one ingress port; the fallback is
 *     allowed for arenas that only authored an opening squad;
 *   - every ingress square is clear of cover;
 *   - NETWORK SWITCH (the first OFFICE LAN arena) is the specific regression case.
 */
import { ARENAS } from '../src/game/arenas';
import { PLAYABLE_CAMPAIGN_LEVELS, campaignChapterForLevel } from '../src/game/campaign';
import { MAX_PLAYERS } from '../src/game/config';
import { World } from '../src/game/world';

const names = new Array<string>(MAX_PLAYERS).fill('');
names[0] = 'QA';
let checked = 0;

for (let i = 0; i < PLAYABLE_CAMPAIGN_LEVELS.length; i++) {
  const level = PLAYABLE_CAMPAIGN_LEVELS[i];
  const arena = ARENAS.find((entry) => entry.id === level.arenaId);
  if (!arena) throw new Error(`${level.name} has no arena ${level.arenaId}`);
  const world = new World(
    'gauntlet',
    names,
    0,
    arena,
    false,
    0,
    0,
    null,
    true,
    level.dataCrates,
    false,
    level.intro,
    level.clearKills,
    false,
    level.boss ?? -1,
    campaignChapterForLevel(level),
    level.opening ?? null,
    level.finale === true,
  ) as any;

  if (world.friendlyFire) throw new Error(`${level.name} is not using the campaign friendly-fire rule`);

  if (level.intro === 'assault' && level.boss === undefined) {
    checked++;
    if (world.portTotal <= 0) throw new Error(`${level.name} has no ingress port or fallback`);
    for (const b of world.props) {
      if (!b.portal || b.portalExit) continue;
      const inside = arena.pillars.some(
        (r) => b.x + b.w > r.x && b.x < r.x + r.w && b.y + b.h > r.y && b.y < r.y + r.h,
      );
      if (inside) throw new Error(`${level.name} has a port buried in cover`);
    }
  }

  if (level.name === 'NETWORK SWITCH') {
    if (world.portTotal !== 1) throw new Error(`NETWORK SWITCH has ${world.portTotal} ports, expected one fallback`);
    const port = world.props.find((b: any) => b.portal && !b.portalExit);
    if (!port) throw new Error('NETWORK SWITCH fallback port is missing');
    console.log(
      `NETWORK SWITCH: fallback port ${port.x.toFixed(0)},${port.y.toFixed(0)} ${port.w}x${port.h}`,
    );
  }
}

if (checked < 20) throw new Error(`only ${checked} non-boss assault levels were audited`);
console.log(`campaign-spawner-check: OK (${checked} non-boss assault devices have a clear ingress port)`);
