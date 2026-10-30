/**
 * Campaign route road.
 *
 * One picture of the whole run at a single scale: the sandbox on the left, the five
 * device clusters along a fiber route, and ROOT on the right. Every stop draws the
 * device the sector actually lives in (build box, office switch, media platter rack,
 * worm-eaten camera/rack, AI core rack) so the five clusters read as different places
 * instead of five copies of the same box.
 *
 * This belongs to the between-level transition, not to a menu: it is the plate a
 * player sees while the next system loads. Not mounted yet, so the archive stays a
 * per-sector blueprint. It never touches `World`, `Snapshot` or a room.
 */
import { fitCanvas } from '../ui/dom';
import { SECTORS, type SectorDef } from './sectors';

const ROAD_W = 960;
const ROAD_H = 340;

/** Stop positions on the fiber route, left to right, in SECTORS order. */
const STOP_X: readonly number[] = [148, 322, 494, 666, 832];
const STOP_Y: readonly number[] = [172, 162, 178, 166, 174];
const CABLE_START_X = 44;
const CABLE_END_X = 916;

/** Label anchor under the cable; every block shares one baseline grid. */
const LABEL_TOP = 34;

export function drawSystemRoad(canvas: HTMLCanvasElement, selected: number): void {
  const ctx = fitCanvas(canvas, ROAD_W, ROAD_H);
  if (!ctx) return;

  drawPlate(ctx);
  drawWeb(ctx);

  // Links under the stops so device art stays legible.
  drawCable(ctx);
  for (let i = 1; i < SECTORS.length; i++) {
    drawCrossing(ctx, i - 1, i, i === selected || i - 1 === selected);
  }
  drawCaps(ctx);
  for (let i = 0; i < SECTORS.length; i++) {
    drawStop(ctx, SECTORS[i], i, i === selected);
  }

  drawLegend(ctx);
  ctx.restore();
}

function drawPlate(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#04080e';
  ctx.fillRect(0, 0, ROAD_W, ROAD_H);

  ctx.strokeStyle = 'rgba(120, 214, 230, 0.05)';
  ctx.lineWidth = 1;
  for (let gx = 48; gx < ROAD_W; gx += 48) {
    ctx.beginPath();
    ctx.moveTo(gx + 0.5, 0);
    ctx.lineTo(gx + 0.5, ROAD_H);
    ctx.stroke();
  }
  for (let gy = 36; gy < ROAD_H; gy += 48) {
    ctx.beginPath();
    ctx.moveTo(0, gy + 0.5);
    ctx.lineTo(ROAD_W, gy + 0.5);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(120, 214, 230, 0.16)';
  ctx.strokeRect(8.5, 8.5, ROAD_W - 17, ROAD_H - 17);
  ctx.strokeStyle = 'rgba(189, 251, 255, 0.5)';
  ctx.lineWidth = 1.5;
  const corners: readonly [number, number, number, number][] = [
    [8, 8, 1, 1],
    [ROAD_W - 8, 8, -1, 1],
    [8, ROAD_H - 8, 1, -1],
    [ROAD_W - 8, ROAD_H - 8, -1, -1],
  ];
  for (let i = 0; i < corners.length; i++) {
    const [x, y, dx, dy] = corners[i];
    ctx.beginPath();
    ctx.moveTo(x + dx * 18, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * 18);
    ctx.stroke();
  }

  ctx.save();
  ctx.fillStyle = 'rgba(141, 247, 255, 0.5)';
  ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('THE ROUTE // SANDBOX TO ROOT', 26, 30);
  ctx.textAlign = 'right';
  ctx.fillText(`${SECTORS.length} SYSTEMS // ${totalArenas()} ARENAS // ONE WAY`, ROAD_W - 26, 30);
  ctx.restore();
}

function totalArenas(): number {
  let total = 0;
  for (let i = 0; i < SECTORS.length; i++) total += SECTORS[i].nodes.length;
  return total;
}

/** Faint world-wide-web globe behind the right third of the plate. */
function drawWeb(ctx: CanvasRenderingContext2D): void {
  const cx = 812;
  const cy = 96;
  const r = 78;
  ctx.save();
  ctx.strokeStyle = 'rgba(120, 214, 230, 0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 1; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, (r * i) / 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, (r * (i + 1)) / 3.4, r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.stroke();
  ctx.restore();
}

/** One continuous fiber cable with a shallow sag per span. */
function traceCable(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(CABLE_START_X, STOP_Y[0] + 4);
  for (let i = 0; i < STOP_X.length; i++) {
    const px = i === 0 ? CABLE_START_X : STOP_X[i - 1];
    const py = i === 0 ? STOP_Y[0] + 4 : STOP_Y[i - 1];
    const mx = (px + STOP_X[i]) / 2;
    const my = (py + STOP_Y[i]) / 2 + 12;
    ctx.quadraticCurveTo(mx, my, STOP_X[i], STOP_Y[i]);
  }
  const lastX = STOP_X[STOP_X.length - 1];
  const lastY = STOP_Y[STOP_Y.length - 1];
  ctx.quadraticCurveTo((lastX + CABLE_END_X) / 2, lastY + 14, CABLE_END_X, lastY - 2);
}

function drawCable(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.lineCap = 'round';
  const layers: readonly [number, number, string][] = [
    [13, 0.05, '#7df8ff'],
    [5, 0.16, '#7df8ff'],
    [1.7, 0.62, '#bdfbff'],
  ];
  for (let i = 0; i < layers.length; i++) {
    const [width, alpha, color] = layers[i];
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    traceCable(ctx);
    ctx.stroke();
  }

  // Packet ticks travelling the cable; static, this is a blueprint not a live feed.
  ctx.globalAlpha = 0.34;
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = '#7df8ff';
  ctx.setLineDash([2, 26]);
  traceCable(ctx);
  ctx.stroke();
  ctx.setLineDash([]);

  // Direction: three chevrons pointing toward ROOT.
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.6;
  const chevrons: readonly [number, number][] = [
    [230, 208],
    [606, 212],
    [886, 192],
  ];
  for (let i = 0; i < chevrons.length; i++) {
    const [x, y] = chevrons[i];
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 5);
    ctx.lineTo(x, y);
    ctx.lineTo(x - 5, y + 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCrossing(ctx: CanvasRenderingContext2D, a: number, b: number, lit: boolean): void {
  const label = SECTORS[b].crossing;
  if (!label) return;
  const x = (STOP_X[a] + STOP_X[b]) / 2;
  const y = (STOP_Y[a] + STOP_Y[b]) / 2 + 12 - 27;
  const accent = SECTORS[b].accent;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const width = ctx.measureText(label).width + 16;
  ctx.globalAlpha = lit ? 0.2 : 0.1;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - width / 2, y - 9, width, 14);
  ctx.globalAlpha = lit ? 0.9 : 0.48;
  ctx.fillStyle = accent;
  ctx.fillText(label, x, y + 1);
  ctx.restore();
}

function drawCaps(ctx: CanvasRenderingContext2D): void {
  const leftY = STOP_Y[0] + 4;
  const rightY = STOP_Y[STOP_Y.length - 1] - 2;

  ctx.save();
  ctx.globalAlpha = 0.46;
  ctx.strokeStyle = '#bdfbff';
  ctx.lineWidth = 1.4;

  // Left cap: a broken link, the sandbox wall.
  ctx.beginPath();
  ctx.arc(CABLE_START_X - 7, leftY, 5.2, Math.PI * 0.35, Math.PI * 1.65);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(CABLE_START_X + 7, leftY, 5.2, Math.PI * 1.35, Math.PI * 0.65);
  ctx.stroke();
  ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#bdfbff';
  ctx.fillText('SANDBOX', CABLE_START_X, leftY - 18);

  // Right cap: the route terminus.
  ctx.beginPath();
  ctx.moveTo(CABLE_END_X - 6, rightY - 5);
  ctx.lineTo(CABLE_END_X, rightY);
  ctx.lineTo(CABLE_END_X - 6, rightY + 5);
  ctx.moveTo(CABLE_END_X + 1, rightY - 5);
  ctx.lineTo(CABLE_END_X + 7, rightY);
  ctx.lineTo(CABLE_END_X + 1, rightY + 5);
  ctx.stroke();
  ctx.textAlign = 'right';
  ctx.fillText('ROOT', CABLE_END_X + 2, rightY - 18);
  ctx.restore();
}

function drawStop(ctx: CanvasRenderingContext2D, sector: SectorDef, index: number, active: boolean): void {
  const x = STOP_X[index];
  const y = STOP_Y[index];
  const accent = sector.accent;

  ctx.save();
  if (active) {
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = accent;
    ctx.fillRect(x - 78, 66, 156, 214);
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - 78, 82);
    ctx.lineTo(x - 78, 66);
    ctx.lineTo(x - 62, 66);
    ctx.moveTo(x + 78, 82);
    ctx.lineTo(x + 78, 66);
    ctx.lineTo(x + 62, 66);
    ctx.stroke();
  }

  // Device assembly above the cable, stem down to the port.
  ctx.save();
  ctx.translate(x, 112);
  drawDevice(ctx, index, accent, active);
  ctx.restore();

  ctx.globalAlpha = active ? 0.55 : 0.24;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, 154);
  ctx.lineTo(x, y - 11);
  ctx.stroke();

  // Port on the cable.
  ctx.globalAlpha = active ? 0.95 : 0.5;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(x, y, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = active ? 0.85 : 0.34;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.stroke();
  if (active) {
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Label block on one shared grid with the other stops.
  const labelTop = y + LABEL_TOP;
  ctx.textAlign = 'center';
  ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.fillStyle = accent;
  ctx.globalAlpha = active ? 1 : 0.62;
  ctx.fillText(sector.code, x, labelTop);

  ctx.font = '700 17px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.fillStyle = active ? '#f2ffff' : 'rgba(222, 250, 255, 0.72)';
  ctx.globalAlpha = 1;
  ctx.fillText(sector.name, x, labelTop + 20);

  ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.fillStyle = active ? accent : 'rgba(150, 219, 230, 0.5)';
  ctx.fillText(sector.subtitle, x, labelTop + 37);

  ctx.fillStyle = 'rgba(189, 251, 255, 0.55)';
  ctx.fillText(`${sector.nodes.length} ARENAS`, x, labelTop + 56);

  // Boss call-out reads as a warning, not as another node label.
  ctx.fillStyle = active ? 'rgba(255, 192, 106, 0.95)' : 'rgba(255, 192, 106, 0.5)';
  ctx.fillText(bossShortName(sector.boss), x, labelTop + 71);
  ctx.restore();
}

function bossShortName(boss: string): string {
  const split = boss.indexOf('//');
  return split === -1 ? boss : boss.slice(split + 2).trim();
}

/**
 * Device silhouettes. Origin is the center of a 150x88 box that sits above the
 * cable. `lit` is the currently reviewed sector; the rest stay dim.
 */
function drawDevice(ctx: CanvasRenderingContext2D, index: number, accent: string, lit: boolean): void {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.fillStyle = '#07131c';
  ctx.lineWidth = 1.35;
  ctx.globalAlpha = lit ? 0.98 : 0.42;

  switch (index) {
    case 0:
      drawBuildBox(ctx, accent);
      break;
    case 1:
      drawOfficeLan(ctx, accent);
      break;
    case 2:
      drawMediaRack(ctx, accent);
      break;
    case 3:
      drawWormRack(ctx, accent);
      break;
    default:
      drawAiCore(ctx, accent);
      break;
  }
  ctx.restore();
}

/** LOCALHOST: a build window with a firewall lock on its edge and a broken link. */
function drawBuildBox(ctx: CanvasRenderingContext2D, accent: string): void {
  ctx.beginPath();
  ctx.rect(-48, -36, 92, 60);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha *= 0.5;
  ctx.beginPath();
  ctx.moveTo(-48, -24);
  ctx.lineTo(44, -24);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = accent;
    ctx.fillRect(-42 + i * 6, -31, 2.4, 2.4);
  }
  ctx.globalAlpha /= 0.5;

  // Prompt.
  ctx.beginPath();
  ctx.moveTo(-36, -14);
  ctx.lineTo(-28, -7);
  ctx.lineTo(-36, 0);
  ctx.moveTo(-24, 0);
  ctx.lineTo(-12, 0);
  ctx.moveTo(-2, -14);
  ctx.lineTo(8, 0);
  ctx.moveTo(8, -14);
  ctx.lineTo(-2, 0);
  ctx.stroke();

  // Firewall lock on the right edge.
  ctx.beginPath();
  ctx.arc(29, -14, 5, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#07131c';
  ctx.beginPath();
  ctx.rect(22, -14, 14, 11);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.fillRect(28, -10, 2, 4);

  // A chain link that has been broken.
  ctx.beginPath();
  ctx.arc(-62, 10, 5.4, Math.PI * 0.3, Math.PI * 1.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-52, 10, 5.4, Math.PI * 1.3, Math.PI * 0.7);
  ctx.stroke();
}

/** OFFICE LAN: a switch with three workstations hanging off it. */
function drawOfficeLan(ctx: CanvasRenderingContext2D, accent: string): void {
  for (let i = 0; i < 3; i++) {
    const dx = -44 + i * 44;
    ctx.beginPath();
    ctx.rect(dx - 12, -36, 24, 15);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha *= 0.7;
    ctx.beginPath();
    ctx.moveTo(dx, -21);
    ctx.lineTo(dx, -15);
    ctx.moveTo(dx - 9, -15);
    ctx.lineTo(dx + 9, -15);
    ctx.stroke();
    ctx.globalAlpha /= 0.7;
    // Cable down to the switch.
    ctx.beginPath();
    ctx.moveTo(dx, -15);
    ctx.lineTo(dx, 4);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.rect(-60, 4, 120, 24);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = accent;
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(-50 + i * 13, 11, 5, 3);
  }
  ctx.globalAlpha *= 0.6;
  ctx.beginPath();
  ctx.moveTo(-50, 21);
  ctx.lineTo(50, 21);
  ctx.stroke();
  ctx.globalAlpha /= 0.6;
}

/** CINEVAULT: a home router next to a disc platter. */
function drawMediaRack(ctx: CanvasRenderingContext2D, accent: string): void {
  // Router with antennas.
  ctx.beginPath();
  ctx.rect(-62, 2, 66, 18);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-56, 2);
  ctx.lineTo(-66, -26);
  ctx.moveTo(-40, 2);
  ctx.lineTo(-30, -26);
  ctx.stroke();
  ctx.globalAlpha *= 0.55;
  ctx.beginPath();
  ctx.moveTo(-54, 10);
  ctx.lineTo(0, 10);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = accent;
    ctx.fillRect(-52 + i * 10, 5, 3, 2.4);
  }
  // Signal arcs.
  for (let i = 1; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(-48, -30, 5 * i, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.stroke();
  }
  ctx.globalAlpha /= 0.55;

  // Platter.
  ctx.fillStyle = '#07131c';
  ctx.beginPath();
  ctx.arc(24, -10, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha *= 0.75;
  ctx.beginPath();
  ctx.arc(24, -10, 6, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.moveTo(24 + Math.cos(angle) * 8, -10 + Math.sin(angle) * 8);
    ctx.lineTo(24 + Math.cos(angle) * 20, -10 + Math.sin(angle) * 20);
    ctx.stroke();
  }
  ctx.globalAlpha /= 0.75;
}

/** BOTNET: a hijacked camera beside a worm-eaten rack. */
function drawWormRack(ctx: CanvasRenderingContext2D, accent: string): void {
  // Camera.
  ctx.save();
  ctx.translate(-44, -22);
  ctx.rotate(-0.32);
  ctx.beginPath();
  ctx.rect(-19, -10, 38, 20);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(9, 0, 6.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(9, 0, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(-24, -12, 6, 24);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-46, -4);
  ctx.lineTo(-46, 20);
  ctx.moveTo(-54, 20);
  ctx.lineTo(-38, 20);
  ctx.stroke();

  // Hollowed rack.
  ctx.beginPath();
  ctx.rect(4, -34, 34, 56);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha *= 0.6;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.rect(9, -27 + i * 16, 24, 9);
    ctx.stroke();
  }
  ctx.globalAlpha /= 0.6;

  // Worms crawling the rack.
  for (let w = 0; w < 2; w++) {
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const px = 0 + i * 4;
      const py = -18 + w * 26 + Math.sin(i * 0.9 + w * 1.7) * 3.4;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

/** SINGULARITY: a GPU rack under a contained core. */
function drawAiCore(ctx: CanvasRenderingContext2D, accent: string): void {
  ctx.beginPath();
  ctx.rect(-52, -18, 48, 54);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha *= 0.7;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.rect(-46, -11 + i * 12, 36, 8);
    ctx.stroke();
  }
  ctx.fillStyle = accent;
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(-43, -8 + i * 12, 2.4, 2.4);
  }
  ctx.globalAlpha /= 0.7;

  // Core orb with a dashed containment ring.
  ctx.fillStyle = '#07131c';
  ctx.beginPath();
  ctx.arc(24, -8, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(24, -8, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha *= 0.7;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.arc(24, -8, 25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(24 + Math.cos(angle) * 6, -8 + Math.sin(angle) * 6);
    ctx.lineTo(24 + Math.cos(angle) * 14, -8 + Math.sin(angle) * 14);
    ctx.stroke();
  }
  ctx.globalAlpha /= 0.7;

  // Heat ticks.
  ctx.globalAlpha *= 0.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-46 + i * 14, 40);
    ctx.lineTo(-46 + i * 14, 46);
    ctx.stroke();
  }
}

function drawLegend(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#bdfbff';

  ctx.beginPath();
  ctx.arc(30, ROAD_H - 18, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = '#bdfbff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(30, ROAD_H - 18, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.fillText('SYSTEM STOP', 46, ROAD_H - 14);

  ctx.globalAlpha = 0.34;
  ctx.textAlign = 'right';
  ctx.fillText('BLUEPRINT ONLY // PADS, BRIDGES AND LIFTS ARE NOT SIMULATED', ROAD_W - 26, ROAD_H - 14);
  ctx.restore();
}
