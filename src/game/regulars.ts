/**
 * Ordinary programs: the civilians of the machine world.
 *
 * They are not roster entries, not `Player` bodies and never enter `World` or a
 * snapshot. A regular is a floating CRT monitor with one muted shell colour, a dark
 * screen and one emoji face. The silhouette stays fixed; colour and face carry identity,
 * so adding a new regular is a data row, not a new drawing.
 */

export const REGULAR_PROGRAMS = [
  {
    id: 'ticket',
    name: 'TICKET',
    role: 'INTAKE',
    face: '😐',
    shell: '#4aa7b8',
    screen: '#07171c',
    accent: '#bdf7ff',
  },
  {
    id: 'patch',
    name: 'PATCH',
    role: 'MAINTENANCE',
    face: '🙂',
    shell: '#c9963f',
    screen: '#1a1207',
    accent: '#ffe0a3',
  },
  {
    id: 'cache',
    name: 'CACHE',
    role: 'INTERN',
    face: '😴',
    shell: '#8d76d1',
    screen: '#120d1e',
    accent: '#dccdff',
  },
  {
    id: 'ping',
    name: 'PING',
    role: 'COURIER',
    face: '😰',
    shell: '#c76b7f',
    screen: '#1c0b10',
    accent: '#ffd2da',
  },
  {
    id: 'script-kitty',
    name: 'SCRIPT KITTY',
    role: 'FRIEND',
    face: '🐱',
    shell: '#67c7b1',
    screen: '#061815',
    accent: '#c7fff4',
  },
] as const;

export type RegularProgramId = (typeof REGULAR_PROGRAMS)[number]['id'];
export type RegularProgramDef = (typeof REGULAR_PROGRAMS)[number];

/** Expressions an unnamed civilian can wear in a room. Calm keeps its portrait face. */
export type RegularMood = 'calm' | 'scared' | 'angry' | 'sad';
export const CIVILIAN_FACES: Record<Exclude<RegularMood, 'calm'>, string> = {
  scared: '😨',
  angry: '😠',
  sad: '😢',
};

export function regularFace(def: RegularProgramDef, mood: RegularMood): string {
  return mood === 'calm' ? def.face : CIVILIAN_FACES[mood];
}

const BY_ID = new Map<string, RegularProgramDef>(REGULAR_PROGRAMS.map((program) => [program.id, program]));

export function regularProgram(id: RegularProgramId): RegularProgramDef {
  return BY_ID.get(id) ?? REGULAR_PROGRAMS[0];
}

const FACE_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", "Segoe UI Symbol", sans-serif';
const TWO_PI = Math.PI * 2;
const FILE_SLOTS = [
  { x: -22, y: -38, angle: -0.42 },
  { x: 21, y: -39, angle: 0.36 },
  { x: 0, y: -56, angle: 0.06 },
] as const;

/**
 * One small folded paper file. Files sit behind the monitor while carried and flat on
 * the floor after a civilian drops them. Flat vector only: no filters, shadows or bitmaps.
 */
function drawFile(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, alpha: number, accent: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#e3ebef';
  ctx.beginPath();
  ctx.moveTo(-5, -7);
  ctx.lineTo(3, -7);
  ctx.lineTo(6, -4);
  ctx.lineTo(6, 7);
  ctx.lineTo(-5, 7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 0.55 * alpha;
  ctx.fillStyle = accent;
  ctx.fillRect(-2, -2, 5, 1);
  ctx.fillRect(-2, 1, 3, 1);
  ctx.restore();
}

/** Draws the carried stack behind a monitor, already in monitor-local coordinates. */
function drawCarriedFiles(ctx: CanvasRenderingContext2D, count: number, alpha: number, accent: string): void {
  const n = Math.max(0, Math.min(FILE_SLOTS.length, count));
  for (let i = 0; i < n; i++) {
    const slot = FILE_SLOTS[i];
    drawFile(ctx, slot.x, slot.y, slot.angle, 0.9 * alpha, accent);
  }
}

/**
 * Drops left on the floor after a civilian flees or is destroyed. The caller fades the
 * stack out; this function only scatters the papers a little so they do not vanish.
 */
export function drawDroppedFiles(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  t: number,
  alpha: number,
  count: number,
  phase = 0,
): void {
  const n = Math.max(0, Math.min(FILE_SLOTS.length, count));
  if (n === 0) return;
  ctx.save();
  ctx.translate(x, groundY);
  for (let i = 0; i < n; i++) {
    const slot = FILE_SLOTS[i];
    const settle = Math.sin(t * 1.8 + phase + i * 1.9) * 1.2;
    drawFile(ctx, slot.x * 1.5, 2 + i * 2 + settle, slot.angle * 0.6, alpha, '#c7d4da');
  }
  ctx.restore();
}

/**
 * Draws one regular at a floor anchor. The CRT shell floats; the emoji face sits on its
 * screen, and carried files overlap behind the shell. A mood can replace the face without
 * changing the monitor's identity colour. `phase` desynchronises a room full of them.
 *
 * There is deliberately no body, neck, stand, wheels, arms or legs. This uses no
 * `shadowBlur`, filters or gradients: shell, screen, files and face are flat layers.
 */
export function drawRegularProgram(
  ctx: CanvasRenderingContext2D,
  def: RegularProgramDef,
  x: number,
  groundY: number,
  t: number,
  scale = 1,
  alpha = 1,
  phase = 0,
  face: string = def.face,
  carry = 0,
): void {
  const hover = 8 + Math.sin(t * 1.7 + phase) * 2.2;
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(scale, scale);

  // Ground shadow and anti-grav ring, anchored under the floating monitor.
  ctx.globalAlpha = 0.28 * alpha;
  ctx.fillStyle = '#020509';
  ctx.beginPath();
  ctx.ellipse(0, 2, 18, 4.5, 0, 0, TWO_PI);
  ctx.fill();
  ctx.globalAlpha = 0.3 * alpha;
  ctx.strokeStyle = def.accent;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 2, 22, 6, 0, 0, TWO_PI);
  ctx.stroke();

  ctx.translate(0, -hover);

  // Files peek out from behind the shell before the monitor is painted over them.
  drawCarriedFiles(ctx, carry, alpha, def.accent);

  // Floating CRT shell: rounded housing, inset bezel and dark screen. No stand or body.
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#070c11';
  ctx.beginPath();
  ctx.roundRect(-26, -48, 52, 36, 7);
  ctx.fill();
  ctx.strokeStyle = def.shell;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#0b1218';
  ctx.beginPath();
  ctx.roundRect(-22, -44, 44, 28, 4);
  ctx.fill();

  ctx.fillStyle = def.screen;
  ctx.beginPath();
  ctx.roundRect(-19, -41, 38, 22, 2);
  ctx.fill();

  // Screen tint and one scan line. The emoji remains a colour bitmap on top.
  ctx.globalAlpha = 0.14 * alpha;
  ctx.fillStyle = def.accent;
  ctx.fillRect(-19, -41, 38, 22);
  ctx.globalAlpha = 0.16 * alpha;
  ctx.fillRect(-19, -30, 38, 1);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.font = `21px ${FACE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(face, 0, -30);

  // Power LED and the shell's top trim: monitor parts, not a face expression.
  const blink = 0.55 + 0.45 * Math.sin(t * 2.3 + phase);
  ctx.globalAlpha = (0.5 + 0.5 * blink) * alpha;
  ctx.fillStyle = def.accent;
  ctx.fillRect(20, -16, 2.5, 2.5);
  ctx.globalAlpha = 0.55 * alpha;
  ctx.fillRect(-19, -46, 38, 1);

  ctx.restore();
}
