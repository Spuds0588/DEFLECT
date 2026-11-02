import assert from 'node:assert/strict';
import { emptyDeflect, SessionTracker, sessionShareText, type SessionMeta, type SessionResult } from '../src/game/sessionReport';
import { EV, type GameEvent } from '../src/game/types';

const meta: SessionMeta = {
  mode: 'bots',
  arenaId: 0,
  arenaName: 'GRID ZERO',
  program: 'PROBE',
  localSlot: 0,
  humanPlayers: 1,
  bots: 1,
  botTier: 'VETERAN',
  friendlyFire: null,
  autoLock: false,
  autoAttack: false,
  touch: false,
  online: false,
  infection: false,
  series: { game: 1, total: 3, mapRule: 'random' },
  campaign: null,
};

const tracker = new SessionTracker('0.1.111', meta, [
  { slot: 0, program: 'PROBE', human: true },
  { slot: 1, program: 'WEDGE', human: false },
]);

const event = (kind: number, slot: number, power = 0): GameEvent => ({
  kind,
  slot,
  x: 0,
  y: 0,
  power,
  dirX: 1,
  dirY: 0,
});
tracker.beginRound(0, 'GRID ZERO', 1, { ...emptyDeflect(), guard: 2 });
tracker.recordEvent(event(EV.SHOOT, 0));
tracker.recordEvent(event(EV.DASH, 0));
tracker.recordEvent(event(EV.SWING, 0));
tracker.recordEvent(event(EV.DEFLECT, 0));
tracker.recordEvent(event(EV.BUG, 0, 1));
tracker.recordEvent(event(EV.LASER, 0));
tracker.recordEvent(event(EV.HIT, 0, 2));
tracker.recordEvent(event(EV.ELIMINATED, 0, 1));
tracker.recordEvent(event(EV.DEFLECT, 0));
tracker.finishRound(
  33.2,
  0,
  0,
  { ...emptyDeflect(), guard: 3 },
  55,
  0.08,
);
tracker.sample(60, 16.2, 0.04);
tracker.sample(50, 20, 0.1);

const result: SessionResult = {
  outcome: 'match-complete',
  winnerSlot: 0,
  matchWinner: 0,
  seriesGame: 1,
  seriesTotal: 3,
  wave: null,
  kills: null,
  seconds: null,
  score: null,
  cleared: null,
};
const report = tracker.build(result, {
  viewportW: 1280,
  viewportH: 720,
  dpr: 1,
  hardwareConcurrency: 8,
  touch: false,
  reducedMotion: false,
});

assert.equal(report.schema, 1);
assert.equal(report.kind, 'session');
assert.equal(report.mode, 'bots');
assert.equal(report.rounds.length, 1);
assert.equal(report.rounds[0].players[0].shots, 1);
assert.equal(report.rounds[0].players[0].swings, 1);
assert.equal(report.rounds[0].players[0].deflects, 2);
assert.equal(report.rounds[0].players[0].skills, 1);
assert.equal(report.rounds[0].players[0].heavies, 1);
assert.equal(report.rounds[0].players[0].hits, 1);
assert.equal(report.rounds[0].deflect.guard, 1);
assert.equal(report.rounds[0].players[1].deaths, 1);
assert.equal(report.summary.wins, 1);
assert.equal(report.summary.shots, 1);
assert.equal(report.summary.kills, 1);
assert.equal(report.summary.deaths, 1);
assert.equal(report.perf.samples, 2);
assert.equal(report.perf.minFps, 50);
assert.match(sessionShareText(report), /SHARE|FULL JSON|GRID ZERO/);
assert.equal(report.privacy.includes('callsigns'), true);

console.log(
  JSON.stringify({
    rounds: report.rounds.length,
    shots: report.summary.shots,
    deflects: report.summary.deflects,
    kills: report.summary.kills,
    deaths: report.summary.deaths,
    minFps: report.perf.minFps,
    maxSimMs: report.perf.maxSimMs,
  }),
);
