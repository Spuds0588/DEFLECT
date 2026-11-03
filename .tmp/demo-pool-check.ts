import { ARENAS } from '../src/game/arenas';
import { PLAYABLE_CAMPAIGN_LEVELS } from '../src/game/campaign';
const campaign = new Set(PLAYABLE_CAMPAIGN_LEVELS.map((l) => String(l.arenaId)));
const pool = ARENAS.filter((a) => {
  if (a.qa) return false;
  if (a.ingress || a.rooms) return false;
  if (campaign.has(String(a.id)) || campaign.has(a.name)) return false;
  return true;
});
console.log('campaign ids:', [...campaign].join(','));
console.log('demo pool:', pool.map((a) => `${a.id}:${a.name}`).join(' | '));
console.log('pool size:', pool.length, 'of', ARENAS.length);
if (pool.length < 3) throw new Error('demo pool too small');
for (const a of pool) {
  if (a.ingress || a.rooms) throw new Error(`${a.name} is level content`);
}
