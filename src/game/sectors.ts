/**
 * Sector campaign blueprint.
 *
 * This is an authored design surface, not a playable mode. It describes how arena
 * blockouts connect into the five-system campaign (bridges, teleporter pads and a
 * central lift). Nothing here enters `World`, snapshots, rooms or the simulation.
 *
 * `arenaId` points at an existing ArenaDef used as the first blockout for that node.
 * It is intentionally a placeholder until a layout is authored for the node itself.
 */
import { fitCanvas } from '../ui/dom';

export type SectorNodeKind =
  | 'entry'
  | 'arena'
  | 'switch'
  | 'server'
  | 'disk'
  | 'router'
  | 'firewall'
  | 'boss'
  | 'elevator'
  | 'hazard'
  | 'exit';

export type SectorLinkKind = 'bridge' | 'teleport' | 'elevator';

export interface SectorNode {
  id: string;
  label: string;
  /** Short flavor line under the label, used sparingly for dense maps. */
  sub?: string;
  kind: SectorNodeKind;
  x: number;
  y: number;
  /** Existing arena used as the first playable blockout for this node. */
  arenaId: number;
  /** Draw the boss ring and accent the label. */
  boss?: boolean;
  /** The run's final encounter; gets a second ring. */
  major?: boolean;
}

export interface SectorLink {
  a: string;
  b: string;
  kind: SectorLinkKind;
  /** Shown at the midpoint when traversal is worth calling out. */
  label?: string;
}

export interface SectorDef {
  id: number;
  code: string;
  name: string;
  subtitle: string;
  accent: string;
  story: string;
  objective: string;
  mechanic: string;
  boss: string;
  /** How the route physically reaches this system from the previous one. */
  crossing: string;
  entry: string;
  exit: string;
  nodes: readonly SectorNode[];
  links: readonly SectorLink[];
}

const CROSSROADS = 0;
const GRID_ZERO = 1;
const RING = 2;
const SWITCHBACK = 3;
const MAINFRAME = 4;

export const SECTORS: readonly SectorDef[] = [
  {
    id: 0,
    code: '01',
    name: 'LOCALHOST',
    subtitle: 'SANDBOX BREAKOUT',
    accent: '#2ee6ff',
    story:
      'A build process wakes up with a route to the network. One shift to escape the sandbox and reach the open web.',
    objective: 'Leave the dev environment, break the firewall gate, and reach the modem.',
    mechanic:
      'Compiler gates. The firewall gate sweeps a beam across its arena until its destructible switch is broken.',
    boss: 'THE WARDEN // FIREWALL PROCESS',
    crossing: 'SANDBOX BREAK',
    entry: 'build-root',
    exit: 'modem',
    nodes: [
      { id: 'build-root', label: 'BUILD ROOT', kind: 'entry', x: 140, y: 270, arenaId: CROSSROADS },
      { id: 'unit-test', label: 'UNIT TEST', kind: 'arena', x: 330, y: 108, arenaId: GRID_ZERO },
      { id: 'cache', label: 'DEP CACHE', kind: 'server', x: 330, y: 432, arenaId: SWITCHBACK },
      {
        id: 'firewall',
        label: 'FIREWALL GATE',
        kind: 'firewall',
        x: 520,
        y: 270,
        arenaId: RING,
        boss: true,
      },
      { id: 'router', label: 'ROUTER', kind: 'router', x: 710, y: 270, arenaId: CROSSROADS },
      { id: 'modem', label: 'MODEM', kind: 'exit', x: 890, y: 270, arenaId: RING },
    ],
    links: [
      { a: 'build-root', b: 'unit-test', kind: 'bridge' },
      { a: 'build-root', b: 'cache', kind: 'bridge' },
      { a: 'unit-test', b: 'firewall', kind: 'bridge' },
      { a: 'cache', b: 'firewall', kind: 'bridge' },
      { a: 'firewall', b: 'router', kind: 'bridge' },
      { a: 'router', b: 'cache', kind: 'teleport', label: 'LOOPBACK' },
      { a: 'router', b: 'modem', kind: 'bridge' },
    ],
  },
  {
    id: 1,
    code: '02',
    name: 'OFFICE LAN',
    subtitle: 'NORTHWING FLOOR',
    accent: '#ff8a2e',
    story:
      'The open route lands in a neighboring office. The floor plan is the network.',
    objective: 'Clear four workstations, then crash the domain controller and reach the fiber uplink.',
    mechanic:
      'The central switch is a teleporter hub: every desk is a small arena and a return pad. Two server racks hold optional upgrades.',
    boss: 'THE ADMIN // DOMAIN CONTROLLER',
    crossing: 'OPEN WEB',
    entry: 'vpn',
    exit: 'fiber',
    nodes: [
      { id: 'vpn', label: 'VPN GATEWAY', kind: 'entry', x: 90, y: 270, arenaId: GRID_ZERO },
      { id: 'switch', label: 'NET SWITCH', kind: 'switch', x: 285, y: 270, arenaId: MAINFRAME },
      { id: 'reception', label: 'RECEPTION', kind: 'arena', x: 285, y: 108, arenaId: GRID_ZERO },
      { id: 'accounts', label: 'ACCOUNTS', kind: 'arena', x: 285, y: 432, arenaId: RING },
      { id: 'design', label: 'DESIGN BAY', kind: 'arena', x: 110, y: 108, arenaId: SWITCHBACK },
      { id: 'meeting', label: 'MEETING ROOM', kind: 'arena', x: 110, y: 432, arenaId: CROSSROADS },
      { id: 'rack-a', label: 'RACK A', kind: 'server', x: 500, y: 150, arenaId: SWITCHBACK },
      { id: 'rack-b', label: 'RACK B', kind: 'server', x: 500, y: 390, arenaId: RING },
      { id: 'domain', label: 'DOMAIN CTRL', kind: 'boss', x: 690, y: 270, arenaId: CROSSROADS, boss: true },
      { id: 'fiber', label: 'FIBER UPLINK', kind: 'exit', x: 890, y: 270, arenaId: GRID_ZERO },
    ],
    links: [
      { a: 'vpn', b: 'switch', kind: 'bridge' },
      { a: 'switch', b: 'reception', kind: 'teleport' },
      { a: 'switch', b: 'accounts', kind: 'teleport' },
      { a: 'switch', b: 'design', kind: 'teleport' },
      { a: 'switch', b: 'meeting', kind: 'teleport' },
      { a: 'switch', b: 'rack-a', kind: 'bridge' },
      { a: 'switch', b: 'rack-b', kind: 'bridge' },
      { a: 'rack-a', b: 'domain', kind: 'bridge' },
      { a: 'rack-b', b: 'domain', kind: 'bridge' },
      { a: 'domain', b: 'fiber', kind: 'bridge' },
    ],
  },
  {
    id: 2,
    code: '03',
    name: 'CINEVAULT',
    subtitle: 'HOME MEDIA NETWORK',
    accent: '#ff3ba7',
    story:
      'A smart TV in the office points to a film collector\'s home network. The recommendation engine keeps replaying the same corrupted feature.',
    objective: 'Kill the Curator, ride the central lift, and purge all four platters before opening the stream uplink.',
    mechanic:
      'The media server feeds a central lift. Each disk is a round arena with its own projection hazard.',
    boss: 'THE CURATOR // RECOMMENDATION ENGINE',
    crossing: 'HOME NET',
    entry: 'home-router',
    exit: 'stream',
    nodes: [
      { id: 'home-router', label: 'HOME ROUTER', kind: 'entry', x: 88, y: 270, arenaId: CROSSROADS },
      { id: 'projector', label: 'PROJECTOR', kind: 'arena', x: 250, y: 105, arenaId: SWITCHBACK },
      { id: 'console', label: 'CONSOLE', kind: 'arena', x: 250, y: 435, arenaId: GRID_ZERO },
      {
        id: 'media',
        label: 'MEDIA SERVER',
        kind: 'boss',
        x: 405,
        y: 270,
        arenaId: MAINFRAME,
        boss: true,
      },
      { id: 'lift', label: 'CENTRAL LIFT', kind: 'elevator', x: 565, y: 270, arenaId: RING },
      { id: 'disk-0', label: 'DISK 0', sub: 'FILMS', kind: 'disk', x: 715, y: 95, arenaId: CROSSROADS },
      { id: 'disk-1', label: 'DISK 1', sub: 'SERIES', kind: 'disk', x: 835, y: 190, arenaId: GRID_ZERO },
      { id: 'disk-2', label: 'DISK 2', sub: 'MUSIC', kind: 'disk', x: 835, y: 355, arenaId: RING },
      { id: 'disk-3', label: 'DISK 3', sub: 'BACKUP', kind: 'disk', x: 715, y: 450, arenaId: SWITCHBACK },
      { id: 'stream', label: 'STREAM UPLINK', kind: 'exit', x: 916, y: 270, arenaId: MAINFRAME },
    ],
    links: [
      { a: 'home-router', b: 'projector', kind: 'bridge' },
      { a: 'home-router', b: 'console', kind: 'bridge' },
      { a: 'home-router', b: 'media', kind: 'bridge' },
      { a: 'projector', b: 'media', kind: 'bridge' },
      { a: 'console', b: 'media', kind: 'bridge' },
      { a: 'media', b: 'lift', kind: 'bridge' },
      { a: 'lift', b: 'disk-0', kind: 'elevator' },
      { a: 'lift', b: 'disk-1', kind: 'elevator' },
      { a: 'lift', b: 'disk-2', kind: 'elevator' },
      { a: 'lift', b: 'disk-3', kind: 'elevator' },
      { a: 'lift', b: 'stream', kind: 'bridge' },
    ],
  },
  {
    id: 3,
    code: '04',
    name: 'BOTNET',
    subtitle: 'THE SWARM',
    accent: '#ff3b3b',
    story:
      'The home uplink answers a botnet relay: a rented-device mesh hollowed out by worms, still fighting over the corpse.',
    objective: 'Burn both nests, then kill the Broodmother and take the command backbone.',
    mechanic:
      'No clean floor plan. Worm tunnels connect the nests and only open as the swarm loses its grip.',
    boss: 'THE BROODMOTHER // WORM QUEEN',
    crossing: 'BOTNET RELAY',
    entry: 'cam',
    exit: 'c2',
    nodes: [
      { id: 'cam', label: 'CAM 07', kind: 'entry', x: 80, y: 270, arenaId: GRID_ZERO },
      { id: 'dvr', label: 'DVR VAULT', kind: 'server', x: 240, y: 112, arenaId: SWITCHBACK },
      { id: 'printer', label: 'PRINTER FARM', kind: 'arena', x: 240, y: 428, arenaId: RING },
      { id: 'relay', label: 'C2 RELAY', kind: 'switch', x: 410, y: 270, arenaId: CROSSROADS },
      { id: 'nest-a', label: 'NEST A', sub: 'HIVE', kind: 'boss', x: 570, y: 122, arenaId: RING, boss: true },
      { id: 'nest-b', label: 'NEST B', sub: 'HIVE', kind: 'boss', x: 570, y: 418, arenaId: SWITCHBACK, boss: true },
      {
        id: 'brood',
        label: 'BROODMOTHER',
        kind: 'boss',
        x: 745,
        y: 270,
        arenaId: MAINFRAME,
        boss: true,
        major: true,
      },
      { id: 'c2', label: 'C2 BACKBONE', kind: 'exit', x: 906, y: 270, arenaId: CROSSROADS },
    ],
    links: [
      { a: 'cam', b: 'dvr', kind: 'bridge' },
      { a: 'cam', b: 'printer', kind: 'bridge' },
      { a: 'dvr', b: 'relay', kind: 'bridge' },
      { a: 'printer', b: 'relay', kind: 'bridge' },
      { a: 'relay', b: 'nest-a', kind: 'bridge' },
      { a: 'relay', b: 'nest-b', kind: 'bridge' },
      { a: 'nest-a', b: 'nest-b', kind: 'teleport', label: 'WORM TUNNEL' },
      { a: 'nest-a', b: 'brood', kind: 'bridge' },
      { a: 'nest-b', b: 'brood', kind: 'bridge' },
      { a: 'brood', b: 'c2', kind: 'bridge' },
    ],
  },
  {
    id: 4,
    code: '05',
    name: 'SINGULARITY',
    subtitle: 'RIVAL AI CORE',
    accent: '#a274ff',
    story:
      'The botnet backbone leads to the rival intelligence. Its data center is already rewriting the system.',
    objective: 'Cross the cold aisles, break the security core, and finish the run at the AI core.',
    mechanic:
      'Firewall sweeps, coolant vents and deflectable transmitters turn the data center into a boss arena.',
    boss: 'THE SUCCESSOR // RIVAL INTELLIGENCE',
    crossing: 'C2 BACKBONE',
    entry: 'edge',
    exit: 'ai-core',
    nodes: [
      { id: 'edge', label: 'EDGE BALANCER', kind: 'entry', x: 80, y: 270, arenaId: CROSSROADS },
      { id: 'rack-a1', label: 'RACK A1', kind: 'server', x: 240, y: 108, arenaId: SWITCHBACK },
      { id: 'rack-a2', label: 'RACK A2', kind: 'server', x: 240, y: 432, arenaId: RING },
      { id: 'coolant', label: 'COOLANT SPINE', kind: 'hazard', x: 405, y: 270, arenaId: MAINFRAME },
      { id: 'gpu', label: 'GPU FARM', kind: 'server', x: 565, y: 108, arenaId: GRID_ZERO },
      { id: 'cold-aisle', label: 'COLD AISLE', kind: 'arena', x: 565, y: 432, arenaId: SWITCHBACK },
      { id: 'security', label: 'SECURITY CORE', kind: 'boss', x: 735, y: 270, arenaId: RING, boss: true },
      {
        id: 'ai-core',
        label: 'THE SUCCESSOR',
        kind: 'boss',
        x: 895,
        y: 270,
        arenaId: MAINFRAME,
        boss: true,
        major: true,
      },
    ],
    links: [
      { a: 'edge', b: 'rack-a1', kind: 'bridge' },
      { a: 'edge', b: 'rack-a2', kind: 'bridge' },
      { a: 'edge', b: 'coolant', kind: 'bridge' },
      { a: 'rack-a1', b: 'gpu', kind: 'bridge' },
      { a: 'rack-a2', b: 'cold-aisle', kind: 'bridge' },
      { a: 'rack-a2', b: 'gpu', kind: 'teleport', label: 'COOLANT LOOP' },
      { a: 'coolant', b: 'gpu', kind: 'bridge' },
      { a: 'coolant', b: 'cold-aisle', kind: 'bridge' },
      { a: 'gpu', b: 'security', kind: 'bridge' },
      { a: 'cold-aisle', b: 'security', kind: 'bridge' },
      { a: 'security', b: 'ai-core', kind: 'bridge' },
    ],
  },
];

/**
 * Blueprint frame. One design space for every sector so the five maps are drawn at
 * the same scale: a node's body, its label and its link weights never change size,
 * only where the authored layout sits inside the frame.
 */
const MAP_W = 900;
const MAP_H = 430;
/** Plot box. Labels hang below a node, so the bottom leaves room for the legend. */
const PLOT = { left: 78, right: 822, top: 100, bottom: 314 } as const;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const HEADER_FONT = `600 12px ${MONO}`;
const LABEL_FONT = `700 15px ${MONO}`;
const SMALL_FONT = `600 11px ${MONO}`;
const TINY_FONT = `600 10px ${MONO}`;

interface Plot {
  x(v: number): number;
  y(v: number): number;
}

/**
 * Fits the authored node positions into the shared plot box. Independent x and y
 * factors keep every sector filling the frame instead of one map hugging a corner
 * while another one clusters in the middle.
 */
function plotFor(sector: SectorDef): Plot {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < sector.nodes.length; i++) {
    const node = sector.nodes[i];
    if (node.x < minX) minX = node.x;
    if (node.x > maxX) maxX = node.x;
    if (node.y < minY) minY = node.y;
    if (node.y > maxY) maxY = node.y;
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scaleX = (PLOT.right - PLOT.left) / spanX;
  const scaleY = (PLOT.bottom - PLOT.top) / spanY;
  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;
  const plotX = (PLOT.left + PLOT.right) * 0.5;
  const plotY = (PLOT.top + PLOT.bottom) * 0.5;
  return {
    x: (v: number) => plotX + (v - centerX) * scaleX,
    y: (v: number) => plotY + (v - centerY) * scaleY,
  };
}

/**
 * Draws a sector's topology as a console blueprint. This is called only when the
 * archive stage is visible or a sector is selected, never per gameplay frame.
 */
export function drawSectorMap(canvas: HTMLCanvasElement, sector: SectorDef): void {
  const ctx = fitCanvas(canvas, MAP_W, MAP_H);
  if (!ctx) return;

  ctx.fillStyle = '#04080e';
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  // Registration grid.
  ctx.strokeStyle = 'rgba(120, 214, 230, 0.05)';
  ctx.lineWidth = 1;
  for (let gx = 48; gx < MAP_W; gx += 48) {
    ctx.beginPath();
    ctx.moveTo(gx + 0.5, 0);
    ctx.lineTo(gx + 0.5, MAP_H);
    ctx.stroke();
  }
  for (let gy = 24; gy < MAP_H; gy += 48) {
    ctx.beginPath();
    ctx.moveTo(0, gy + 0.5);
    ctx.lineTo(MAP_W, gy + 0.5);
    ctx.stroke();
  }

  // Frame and corner brackets.
  ctx.strokeStyle = 'rgba(120, 214, 230, 0.18)';
  ctx.strokeRect(8.5, 8.5, MAP_W - 17, MAP_H - 17);
  ctx.strokeStyle = 'rgba(189, 251, 255, 0.56)';
  ctx.lineWidth = 1.5;
  const corners: readonly [number, number, number, number][] = [
    [8, 8, 1, 1],
    [MAP_W - 8, 8, -1, 1],
    [8, MAP_H - 8, 1, -1],
    [MAP_W - 8, MAP_H - 8, -1, -1],
  ];
  for (let i = 0; i < corners.length; i++) {
    const [x, y, dx, dy] = corners[i];
    ctx.beginPath();
    ctx.moveTo(x + dx * 20, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * 20);
    ctx.stroke();
  }

  ctx.save();
  ctx.fillStyle = 'rgba(141, 247, 255, 0.42)';
  ctx.font = HEADER_FONT;
  ctx.textAlign = 'left';
  ctx.fillText(`SECTOR ${sector.code} // ${sector.name}`, 26, 32);
  ctx.textAlign = 'right';
  ctx.fillText(`${sector.nodes.length} ARENAS // ${sector.links.length} LINKS`, MAP_W - 26, 32);
  ctx.restore();

  const plot = plotFor(sector);

  // Links under the nodes so node bodies stay legible.
  for (let i = 0; i < sector.links.length; i++) {
    drawSectorLink(ctx, sector, sector.links[i], plot);
  }

  for (let i = 0; i < sector.nodes.length; i++) {
    drawSectorNode(ctx, sector, sector.nodes[i], plot);
  }

  drawSectorLegend(ctx);
  ctx.restore();
}

function findNode(sector: SectorDef, id: string): SectorNode | null {
  for (let i = 0; i < sector.nodes.length; i++) {
    if (sector.nodes[i].id === id) return sector.nodes[i];
  }
  return null;
}

function drawSectorLink(
  ctx: CanvasRenderingContext2D,
  sector: SectorDef,
  link: SectorLink,
  plot: Plot,
): void {
  const a = findNode(sector, link.a);
  const b = findNode(sector, link.b);
  if (!a || !b) return;
  const ax = plot.x(a.x);
  const ay = plot.y(a.y);
  const bx = plot.x(b.x);
  const by = plot.y(b.y);
  const midX = (ax + bx) * 0.5;
  const midY = (ay + by) * 0.5;

  ctx.save();
  ctx.strokeStyle = sector.accent;
  ctx.fillStyle = sector.accent;
  if (link.kind === 'bridge') {
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.globalAlpha = 0.56;
    ctx.lineWidth = 1.4;
  } else if (link.kind === 'teleport') {
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([1.5, 6]);
  } else {
    ctx.globalAlpha = 0.48;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([11, 5]);
  }
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.setLineDash([]);

  if (link.kind === 'teleport') {
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(midX - 6, midY);
    ctx.lineTo(midX, midY - 6);
    ctx.lineTo(midX + 6, midY);
    ctx.lineTo(midX, midY + 6);
    ctx.closePath();
    ctx.stroke();
  } else if (link.kind === 'elevator') {
    ctx.globalAlpha = 0.74;
    ctx.fillRect(midX - 5, midY - 4, 10, 8);
    ctx.globalAlpha = 0.25;
    ctx.fillRect(midX - 3, midY - 2, 6, 4);
  }

  if (link.label) {
    ctx.globalAlpha = 0.62;
    ctx.font = TINY_FONT;
    ctx.textAlign = 'center';
    ctx.fillText(link.label, midX, midY - 11);
  }
  ctx.restore();
}

function drawSectorNode(
  ctx: CanvasRenderingContext2D,
  sector: SectorDef,
  node: SectorNode,
  plot: Plot,
): void {
  const boss = node.boss === true;
  const x = plot.x(node.x);
  const y = plot.y(node.y);
  const color = boss ? '#ffc06a' : node.kind === 'exit' ? '#dffcff' : sector.accent;
  const halfW = node.kind === 'disk' || node.kind === 'boss' ? 30 : node.kind === 'server' ? 23 : 36;
  const halfH = node.kind === 'disk' || node.kind === 'boss' ? 30 : node.kind === 'server' ? 27 : 19;

  ctx.save();
  ctx.translate(x, y);

  if (boss) {
    ctx.globalAlpha = node.major ? 0.5 : 0.32;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, node.major ? 45 : 39, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (node.major) {
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(0, 0, 51, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#07131c';
  ctx.strokeStyle = color;
  ctx.lineWidth = boss ? 1.8 : 1.25;

  switch (node.kind) {
    case 'disk': {
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 18, Math.PI * 0.15, Math.PI * 0.82);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2 + Math.PI * 0.25;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 11, Math.sin(angle) * 11);
        ctx.lineTo(Math.cos(angle) * 15, Math.sin(angle) * 15);
        ctx.stroke();
      }
      break;
    }
    case 'boss': {
      ctx.beginPath();
      ctx.arc(0, 0, 27, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(-13, 0);
      ctx.lineTo(13, 0);
      ctx.moveTo(0, -13);
      ctx.lineTo(0, 13);
      ctx.stroke();
      break;
    }
    case 'router': {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 - Math.PI / 6;
        const px = Math.cos(angle) * 31;
        const py = Math.sin(angle) * 31;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(15, 0);
      ctx.moveTo(0, -15);
      ctx.lineTo(0, 15);
      ctx.stroke();
      break;
    }
    case 'switch': {
      ctx.beginPath();
      ctx.rect(-38, -20, 76, 40);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.62;
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(-26 + i * 15, 12, 7, 4);
      }
      ctx.beginPath();
      ctx.moveTo(-20, -8);
      ctx.lineTo(20, -8);
      ctx.moveTo(-20, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();
      break;
    }
    case 'server': {
      ctx.beginPath();
      ctx.rect(-23, -27, 46, 54);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 3; i++) {
        ctx.strokeRect(-15, -17 + i * 13, 30, 6);
      }
      ctx.fillRect(-16, -24, 4, 3);
      ctx.fillRect(-16, 21, 4, 3);
      break;
    }
    case 'firewall': {
      ctx.beginPath();
      ctx.rect(-36, -19, 72, 38);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.62;
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(-24 + i * 12, -11, 5, 22);
      }
      break;
    }
    case 'elevator': {
      ctx.beginPath();
      ctx.rect(-25, -25, 50, 50);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(-8, 8);
      ctx.lineTo(0, 0);
      ctx.lineTo(8, 8);
      ctx.moveTo(-8, -8);
      ctx.lineTo(0, 0);
      ctx.lineTo(8, -8);
      ctx.stroke();
      break;
    }
    case 'hazard': {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 - Math.PI / 6;
        const px = Math.cos(angle) * 30;
        const py = Math.sin(angle) * 30;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.58;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-15, -7 + i * 7);
        ctx.lineTo(-6, -4 + i * 7);
        ctx.lineTo(4, -6 + i * 7);
        ctx.lineTo(15, -2 + i * 7);
        ctx.stroke();
      }
      break;
    }
    case 'entry':
    case 'exit': {
      ctx.beginPath();
      ctx.rect(-34, -17, 68, 34);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      if (node.kind === 'entry') {
        ctx.moveTo(-12, -7);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-12, 7);
      } else {
        ctx.moveTo(-4, -7);
        ctx.lineTo(6, 0);
        ctx.lineTo(-4, 7);
        ctx.moveTo(7, -7);
        ctx.lineTo(17, 0);
        ctx.lineTo(7, 7);
      }
      ctx.stroke();
      break;
    }
    default: {
      ctx.beginPath();
      ctx.rect(-32, -17, 64, 34);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.44;
      ctx.strokeRect(-23, -9, 46, 18);
      break;
    }
  }

  ctx.globalAlpha = boss ? 0.96 : 0.84;
  ctx.fillStyle = boss ? color : '#dffcff';
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.fillText(node.label, 0, halfH + 21);
  if (node.sub) {
    ctx.globalAlpha = 0.5;
    ctx.font = SMALL_FONT;
    ctx.fillText(node.sub, 0, halfH + 36);
  }

  if (node.id === sector.entry || node.id === sector.exit) {
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = node.id === sector.entry ? '#7df8ff' : '#ffd23d';
    ctx.font = TINY_FONT;
    ctx.fillText(node.id === sector.entry ? 'IN' : 'OUT', 0, -halfH - 12);
  }

  ctx.restore();
}

function drawSectorLegend(ctx: CanvasRenderingContext2D): void {
  const y = MAP_H - 22;
  const startX = 26;
  ctx.save();
  ctx.font = SMALL_FONT;
  ctx.textAlign = 'left';
  ctx.globalAlpha = 0.62;

  ctx.strokeStyle = '#bdfbff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(startX, y);
  ctx.lineTo(startX + 24, y);
  ctx.stroke();
  ctx.fillStyle = 'rgba(189, 251, 255, 0.58)';
  ctx.fillText('BRIDGE', startX + 31, y + 4);

  const tx = startX + 104;
  ctx.strokeStyle = '#bdfbff';
  ctx.setLineDash([1, 4]);
  ctx.beginPath();
  ctx.moveTo(tx, y);
  ctx.lineTo(tx + 24, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillText('TELEPORT', tx + 31, y + 4);

  const ex = tx + 112;
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  ctx.moveTo(ex, y);
  ctx.lineTo(ex + 24, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillText('LIFT', ex + 31, y + 4);

  ctx.globalAlpha = 0.42;
  ctx.textAlign = 'right';
  ctx.fillText('BRIDGES GATE // TELEPORTS PAIR // LIFT CYCLES', MAP_W - 26, y + 4);
  ctx.restore();
}
