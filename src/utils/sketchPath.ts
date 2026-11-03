import { SketchStyle } from '../types/wireframe';

/**
 * Deterministic string hash to 32-bit unsigned integer
 */
export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Mulberry32 deterministic PRNG returning values in [0, 1)
 */
export function createSeededRandom(seedStr: string): () => number {
  let a = hashString(seedStr) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fmt(n: number): string {
  return Math.round(n * 10) / 10 + '';
}

/**
 * Generates a hand-drawn or crisp SVG line segment between (x1, y1) and (x2, y2).
 */
export function sketchLinePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: string,
  style: SketchStyle,
  roughness = 1.35
): string {
  if (style === 'clean') {
    return `M ${fmt(x1)} ${fmt(y1)} L ${fmt(x2)} ${fmt(y2)}`;
  }

  const rand = createSeededRandom(seed);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const jitter = Math.min(roughness, Math.max(0.4, len * 0.008));

  // Primary stroke with slight organic bow
  const mid1X = x1 + dx * 0.35 + (rand() - 0.5) * jitter * 2.2;
  const mid1Y = y1 + dy * 0.35 + (rand() - 0.5) * jitter * 2.2;
  const mid2X = x1 + dx * 0.68 + (rand() - 0.5) * jitter * 2.2;
  const mid2Y = y1 + dy * 0.68 + (rand() - 0.5) * jitter * 2.2;

  const sx1 = x1 + (rand() - 0.5) * jitter * 0.8;
  const sy1 = y1 + (rand() - 0.5) * jitter * 0.8;
  const ex1 = x2 + (rand() - 0.5) * jitter * 0.9;
  const ey1 = y2 + (rand() - 0.5) * jitter * 0.9;

  // Subtle second pass for authentic marker feel on medium/long segments
  const sx2 = x1 + (rand() - 0.5) * jitter * 0.9;
  const sy2 = y1 + (rand() - 0.5) * jitter * 0.9;
  const midB1X = x1 + dx * 0.5 + (rand() - 0.5) * jitter * 1.4;
  const midB1Y = y1 + dy * 0.5 + (rand() - 0.5) * jitter * 1.4;
  const ex2 = x2 + (rand() - 0.5) * jitter * 0.8;
  const ey2 = y2 + (rand() - 0.5) * jitter * 0.8;

  if (len < 28) {
    return `M ${fmt(sx1)} ${fmt(sy1)} Q ${fmt(midB1X)} ${fmt(midB1Y)} ${fmt(ex1)} ${fmt(ey1)}`;
  }

  return [
    `M ${fmt(sx1)} ${fmt(sy1)} C ${fmt(mid1X)} ${fmt(mid1Y)}, ${fmt(mid2X)} ${fmt(mid2Y)}, ${fmt(ex1)} ${fmt(ey1)}`,
    `M ${fmt(sx2)} ${fmt(sy2)} Q ${fmt(midB1X)} ${fmt(midB1Y)} ${fmt(ex2)} ${fmt(ey2)}`,
  ].join(' ');
}

/**
 * Generates both a fill polygon path and a sketchy border stroke path for a rectangle.
 */
export function sketchRectPaths(
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
  style: SketchStyle,
  radius = 3
): { fillPath: string; strokePath: string } {
  const r = Math.min(radius, w / 2, h / 2);
  if (style === 'clean') {
    if (r <= 0) {
      const p = `M ${fmt(x)} ${fmt(y)} H ${fmt(x + w)} V ${fmt(y + h)} H ${fmt(x)} Z`;
      return { fillPath: p, strokePath: p };
    }
    const p = [
      `M ${fmt(x + r)} ${fmt(y)}`,
      `H ${fmt(x + w - r)}`,
      `Q ${fmt(x + w)} ${fmt(y)} ${fmt(x + w)} ${fmt(y + r)}`,
      `V ${fmt(y + h - r)}`,
      `Q ${fmt(x + w)} ${fmt(y + h)} ${fmt(x + w - r)} ${fmt(y + h)}`,
      `H ${fmt(x + r)}`,
      `Q ${fmt(x)} ${fmt(y + h)} ${fmt(x)} ${fmt(y + h - r)}`,
      `V ${fmt(y + r)}`,
      `Q ${fmt(x)} ${fmt(y)} ${fmt(x + r)} ${fmt(y)}`,
      'Z',
    ].join(' ');
    return { fillPath: p, strokePath: p };
  }

  const rand = createSeededRandom(seed);
  const j = 1.1;
  const p1x = x + (rand() - 0.5) * j;
  const p1y = y + (rand() - 0.5) * j;
  const p2x = x + w + (rand() - 0.5) * j;
  const p2y = y + (rand() - 0.5) * j;
  const p3x = x + w + (rand() - 0.5) * j;
  const p3y = y + h + (rand() - 0.5) * j;
  const p4x = x + (rand() - 0.5) * j;
  const p4y = y + h + (rand() - 0.5) * j;

  const fillPath = `M ${fmt(p1x)} ${fmt(p1y)} L ${fmt(p2x)} ${fmt(p2y)} L ${fmt(p3x)} ${fmt(p3y)} L ${fmt(p4x)} ${fmt(p4y)} Z`;

  const top = sketchLinePath(x, y, x + w, y, `${seed}-t`, 'hand', 1.2);
  const right = sketchLinePath(x + w, y, x + w, y + h, `${seed}-r`, 'hand', 1.2);
  const bottom = sketchLinePath(x + w, y + h, x, y + h, `${seed}-b`, 'hand', 1.2);
  const left = sketchLinePath(x, y + h, x, y, `${seed}-l`, 'hand', 1.2);

  return {
    fillPath,
    strokePath: `${top} ${right} ${bottom} ${left}`,
  };
}

/**
 * Generates a hand-drawn ellipse or circle path.
 */
export function sketchEllipsePath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: string,
  style: SketchStyle
): string {
  if (style === 'clean') {
    return [
      `M ${fmt(cx - rx)} ${fmt(cy)}`,
      `A ${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(cx + rx)} ${fmt(cy)}`,
      `A ${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(cx - rx)} ${fmt(cy)}`,
      'Z',
    ].join(' ');
  }

  const rand = createSeededRandom(seed);
  const steps = 16;
  const pts: Array<[number, number]> = [];
  const wobble = Math.min(1.6, Math.max(0.5, Math.min(rx, ry) * 0.05));

  // Slightly overlap past 2*PI so the hand-drawn loop closes like an ink sketch
  const totalSteps = steps + 2;
  for (let i = 0; i <= totalSteps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const ox = (rand() - 0.5) * wobble * 2;
    const oy = (rand() - 0.5) * wobble * 2;
    pts.push([cx + Math.cos(angle) * rx + ox, cy + Math.sin(angle) * ry + oy]);
  }

  let d = `M ${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i][0] + pts[i + 1][0]) / 2;
    const yc = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q ${fmt(pts[i][0])} ${fmt(pts[i][1])} ${fmt(xc)} ${fmt(yc)}`;
  }
  return d;
}

/**
 * Generates diagonal sketchy hatch lines clipped to a rectangle for low-fi shading.
 */
export function sketchHatchPath(
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
  spacing = 10
): string {
  const segments: string[] = [];
  const rand = createSeededRandom(seed);
  const maxDist = w + h;

  for (let d = spacing; d < maxDist; d += spacing) {
    // Intersect x' + y' = d inside [0, w] x [0, h]
    const xStart = Math.max(0, d - h);
    const yStart = d - xStart;
    const xEnd = Math.min(w, d);
    const yEnd = d - xEnd;

    if (xEnd > xStart || yEnd < yStart) {
      const j = (rand() - 0.5) * 1.2;
      segments.push(
        `M ${fmt(x + xStart)} ${fmt(y + yStart + j)} L ${fmt(x + xEnd)} ${fmt(y + yEnd - j)}`
      );
    }
  }
  return segments.join(' ');
}

/**
 * Generates Balsamiq-style squiggly scribble text lines inside a paragraph box.
 */
export function sketchScribbleLinesPath(
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
  style: SketchStyle
): string {
  const rand = createSeededRandom(seed);
  const lineHeight = 18;
  const maxLines = Math.max(1, Math.floor((h - 4) / lineHeight));
  const paths: string[] = [];

  for (let line = 0; line < maxLines; line++) {
    const ly = y + 10 + line * lineHeight;
    const isLast = line === maxLines - 1 && maxLines > 1;
    const lineRatio = isLast ? 0.45 + rand() * 0.25 : 0.82 + rand() * 0.16;
    const targetW = Math.max(24, w * lineRatio);

    if (style === 'clean') {
      paths.push(`M ${fmt(x)} ${fmt(ly)} H ${fmt(x + targetW)}`);
      continue;
    }

    // Create 3-5 "word" squiggle blocks per line
    let cursorX = x;
    while (cursorX < x + targetW - 14) {
      const wordW = Math.min(x + targetW - cursorX, 22 + rand() * 46);
      let d = `M ${fmt(cursorX)} ${fmt(ly)}`;
      const waves = Math.max(2, Math.floor(wordW / 9));
      const stepW = wordW / waves;
      for (let s = 0; s < waves; s++) {
        const mx = cursorX + s * stepW + stepW * 0.5;
        const my = ly + (s % 2 === 0 ? -2.4 : 2.4) + (rand() - 0.5) * 1.1;
        const ex = cursorX + (s + 1) * stepW;
        const ey = ly + (rand() - 0.5) * 1.2;
        d += ` Q ${fmt(mx)} ${fmt(my)} ${fmt(ex)} ${fmt(ey)}`;
      }
      paths.push(d);
      cursorX += wordW + 8 + rand() * 5;
    }
  }

  return paths.join(' ');
}
