/**
 * Gameplay tuning lives in `./tuning/*.json` so it can be edited without touching a
 * system. This file imports those records, adds the few values that are derived from
 * view geometry, and re-exports everything under the old names: no system imports JSON
 * directly.
 *
 * Units are virtual pixels (1280x720 space) and seconds unless noted. Vite hot-reloads
 * a JSON edit into a running dev session. See `./tuning/README.md` for the file map.
 *
 * What stays here on purpose: engine limits (`MAX_PLAYERS`, `SIM_HZ`, pool sizes), the
 * view size and the render palette. Those are not feel knobs.
 */

import campaignJson from './tuning/campaign.json';
import playerJson from './tuning/player.json';
import programsJson from './tuning/programs.json';
import threatsJson from './tuning/threats.json';
import worldJson from './tuning/world.json';

export const VIEW_W = 1280;
export const VIEW_H = 720;
/** World units per screen pixel. Higher = closer camera. */
export const CAMERA_ZOOM = 1.28;

export const MAX_PLAYERS = 8;
export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;
export const MAX_PROJECTILES = 96;
export const MAX_EVENTS = 64;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// --- Player ----------------------------------------------------------------

export const PLAYER = {
  ...playerJson.PLAYER,
  /** Half of a 180 degree sector. Kept here so the angle stays readable and exact. */
  swingHalfAngle: Math.PI / 2,
  guardHalfAngle: Math.PI / 2,
};
export const BOLT = playerJson.BOLT;
export const BUG = playerJson.BUG;
export const MINE = playerJson.MINE;
/** Local input assist: distance where auto-attack switches from ranged to melee. */
export const AUTO_ATTACK = playerJson.AUTO_ATTACK;

// --- Program kits ----------------------------------------------------------

export const WEDGE = programsJson.WEDGE;
export const FISHER = programsJson.FISHER;
export const SWEEP = {
  ...programsJson.SWEEP,
  /** Derived from the view so a camera-zoom change keeps the broom's screen coverage. */
  powerRise: (VIEW_H / CAMERA_ZOOM) * 0.5,
  powerSpan: (VIEW_W / CAMERA_ZOOM) * 0.4,
};
export const TOXIC = programsJson.TOXIC;
export const KABOOM = programsJson.KABOOM;
export const BUFFER = programsJson.BUFFER;
export const ATOMIZE = programsJson.ATOMIZE;
export const GHOST = programsJson.GHOST;

// --- World, camera and session pacing -------------------------------------

export const CAMERA = worldJson.CAMERA;
export const FALL = worldJson.FALL;
export const FILE_PROP = worldJson.FILE_PROP;
export const ARENA = worldJson.ARENA;
export const EMITTER = worldJson.EMITTER;
export const TRAVERSE = worldJson.TRAVERSE;
export const POWERUP = worldJson.POWERUP;
export const ROUND = worldJson.ROUND;
export const TRAINING = worldJson.TRAINING;
export const NET = worldJson.NET;
export const ATTRACT = worldJson.ATTRACT;

/** Player travel state kind. Kept in code because it is a state value, not tuning. */
export const TRAVEL = {
  none: 0,
  pad: 1,
  lift: 2,
} as const;

// --- Campaign --------------------------------------------------------------

export const CAMPAIGN = campaignJson.CAMPAIGN;

// --- Threats ---------------------------------------------------------------

export const GAUNTLET = threatsJson.GAUNTLET;
export const WORM = threatsJson.WORM;
export const VIRUS = threatsJson.VIRUS;
export const SENTRY = threatsJson.SENTRY;
export const CASCADING_ERROR = threatsJson.CASCADING_ERROR;
export const THRALL = threatsJson.THRALL;
export const FIREWALL = threatsJson.FIREWALL;

// --- Render constants ------------------------------------------------------

export const TRAIL_LEN = 12;

export const COLORS = {
  bg: '#05070c',
  grid: 'rgba(52, 132, 164, 0.13)',
  frame: '#1c8ea6',
  frameSoft: 'rgba(38, 166, 190, 0.28)',
  pillarFill: '#173247',
  pillarPanel: '#1e4159',
  pillarEdge: 'rgba(118, 230, 248, 0.8)',
  text: '#d7f6ff',
  textDim: 'rgba(160, 220, 235, 0.55)',
  danger: '#ff5a3c',
  neutral: '#bfe9ff',
  white: '#ffffff',
} as const;
