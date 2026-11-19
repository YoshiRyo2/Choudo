/**
 * Pure mask clean-up for garment cut-outs (no sharp, no files), so it can be tested.
 *
 * A mask is a Uint8Array of w×h cells, 1 = garment, 0 = background, row by row.
 * Images are Uint8Array/Buffer RGBA (4 bytes per pixel) or RGB (3).
 */

const NEIGHBOURS_4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const NEIGHBOURS_8 = [...NEIGHBOURS_4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Soft alpha (0–255) -> binary mask: 1 where alpha is at least `cut`. */
export function threshold(alpha, cut = 128) {
  const mask = new Uint8Array(alpha.length);
  for (let i = 0; i < alpha.length; i++) mask[i] = alpha[i] >= cut ? 1 : 0;
  return mask;
}

/** 4-connected flood fill from the `starts` cells over cells where test(value) holds. */
function flood(grid, w, h, starts, test) {
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (const i of starts) {
    if (!seen[i] && test(grid[i])) { seen[i] = 1; stack.push(i); }
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of NEIGHBOURS_4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (!seen[j] && test(grid[j])) { seen[j] = 1; stack.push(j); }
    }
  }
  return seen;
}

/** Keep only the biggest connected piece of garment: drops stray bits of floor or other clothes. */
export function largestRegion(mask, w, h) {
  const label = new Int32Array(w * h); // 0 = unlabelled
  let best = 0, bestCount = 0, next = 0;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || label[i]) continue;
    const id = ++next;
    let count = 0;
    const stack = [i];
    label[i] = id;
    while (stack.length) {
      const k = stack.pop();
      count++;
      const x = k % w;
      const y = (k - x) / w;
      for (const [dx, dy] of NEIGHBOURS_4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (mask[j] && !label[j]) { label[j] = id; stack.push(j); }
      }
    }
    if (count > bestCount) { best = id; bestCount = count; }
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = best && label[i] === best ? 1 : 0;
  return out;
}

/** Fill holes: background not connected to the image border becomes garment (a print the model missed). */
export function fillHoles(mask, w, h) {
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  const outside = flood(mask, w, h, border, (v) => v === 0);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = outside[i] ? 0 : 1;
  return out;
}

/**
 * Distance in 8-connected steps from each cell to the nearest cell where `from`
 * is 1 (0 on those cells), up to `max`; -1 beyond it. Also returns, for each
 * reached cell, the index of the source cell it was reached from.
 */
function spread(from, w, h, max) {
  const dist = new Int32Array(w * h).fill(-1);
  const src = new Int32Array(w * h).fill(-1);
  let ring = [];
  for (let i = 0; i < w * h; i++) if (from[i]) { dist[i] = 0; src[i] = i; ring.push(i); }
  for (let d = 1; d <= max && ring.length; d++) {
    const next = [];
    for (const i of ring) {
      const x = i % w;
      const y = (i - x) / w;
      for (const [dx, dy] of NEIGHBOURS_8) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (dist[j] !== -1) continue;
        dist[j] = d;
        src[j] = src[i];
        next.push(j);
      }
    }
    ring = next;
  }
  return { dist, src };
}

/** Shrink the mask by `r` px all round, so the fringe where garment meets floor is dropped. */
export function erode(mask, w, h, r) {
  if (r <= 0) return Uint8Array.from(mask);
  // Work on a copy with a 1-cell background frame, so cells off the image count as background.
  const W = w + 2, H = h + 2;
  const background = new Uint8Array(W * H).fill(1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) background[(y + 1) * W + x + 1] = mask[y * w + x] ? 0 : 1;
  const { dist } = spread(background, W, H, r);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) out[y * w + x] = mask[y * w + x] && dist[(y + 1) * W + x + 1] === -1 ? 1 : 0;
  }
  return out;
}

/**
 * Cut out the garment and pad it: garment pixels keep their colour, and every
 * pixel within `pad` px outside the mask copies the colour of the nearest
 * garment pixel. Everything else is transparent. Returns RGBA.
 *
 * With `toward` ([r, g, b]), the padding fades from the nearest colour into
 * that one (the garment's median) the further out it is, so where a drawn size
 * reaches past the photo it shows plain fabric rather than streaks.
 *
 * The app warps the photo onto outlines that never match the photo's exactly,
 * so the padding keeps every size's edge the garment's own colour, never floor.
 */
export function padNearest(rgb, channels, mask, w, h, pad, toward = null) {
  const { dist, src } = spread(mask, w, h, pad);
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const d = dist[i];
    if (d === -1) continue;
    const s = src[i] * channels;
    const t = toward && d > 0 ? Math.min(1, d / pad) : 0;
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(rgb[s + c] + ((toward?.[c] ?? 0) - rgb[s + c]) * t);
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Smallest box holding every garment cell, or null for an empty mask. */
export function boundingBox(mask, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/**
 * How big the garment is drawn in the output: its longest side shrinks so that,
 * with `margin` px all round, the image is at most `maxSide` px. Never enlarged.
 */
export function outputScale(box, maxSide, margin) {
  return Math.min(1, (maxSide - 2 * margin) / Math.max(box.width, box.height));
}

/** Median colour of the garment pixels in an image with `channels` bytes per pixel, as [r, g, b]; null if none. */
export function medianRgb(pixels, channels, mask) {
  const values = [[], [], []];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    for (let c = 0; c < 3; c++) values[c].push(pixels[i * channels + c]);
  }
  if (!values[0].length) return null;
  return values.map((v) => v.sort((a, b) => a - b)[v.length >> 1]);
}

/** Median colour of the garment pixels (RGBA), as #rrggbb. */
export function medianColour(rgba, mask) {
  const median = medianRgb(rgba, 4, mask);
  return median && `#${median.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The whole clean-up for a model's soft mask at output size: threshold, keep the
 * biggest piece, fill holes, erode, then pad with the nearest garment colour,
 * fading into the garment's median colour further out.
 * `rgb` and `alpha` are the same w×h; the result is RGBA plus the eroded mask.
 */
export function cleanCutOut(rgb, channels, alpha, w, h, { erodePx, padPx }) {
  const mask = erode(fillHoles(largestRegion(threshold(alpha), w, h), w, h), w, h, erodePx);
  return { rgba: padNearest(rgb, channels, mask, w, h, padPx, medianRgb(rgb, channels, mask)), mask };
}
