#!/usr/bin/env node
/**
 * Build step for garment photo textures: cut a solid-colour garment out of a
 * product photo and save it as a transparent PNG under public/garments/.
 *
 *   npm run photos              # cut out every photo whose source file is present
 *   npm run photos -- --overlay # also draw each garment's landmarks from seed.json
 *                               # onto a copy (…-overlay.png) for checking by eye
 *
 * Photos are not committed (we don't hold the rights), so sources live in
 * photo-sources/ and outputs in public/garments/, both git-ignored. Without the
 * PNG the app simply draws the garment in its flat colour.
 *
 * The cut-out keeps pixels whose hue and saturation match the garment — a model's
 * skin is the same hue as an orange tee but far less saturated — then keeps only
 * the region connected to a seed point on the garment and fills small holes.
 *
 * Optionally (`bleed` in the config) the garment's edge colours are smeared
 * outward that many pixels, filling the background, the neck opening and any
 * notches where hands covered the hem. The app warps the photo onto outlines
 * that never match the photo's exactly; the bleed means a slightly larger
 * outline still gets cloth texture at its edges instead of a gap.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(join(APP, 'scripts/garment-photos.json'), 'utf8'));
const seed = JSON.parse(await readFile(join(APP, 'src/domain/garments/seed.json'), 'utf8'));
const withOverlay = process.argv.includes('--overlay');

/** RGB 0–255 -> hue (degrees), saturation and value (0–1). */
function hsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max / 255 };
}

const hueDistance = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

async function cutOut(photo) {
  const { data, info } = await sharp(join(APP, photo.source))
    .extract(photo.crop)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const at = (x, y) => (y * w + x) * 3;

  // Reference colour: median of a patch around the seed point.
  const patch = [];
  for (let y = photo.seed[1] - 10; y <= photo.seed[1] + 10; y++) {
    for (let x = photo.seed[0] - 10; x <= photo.seed[0] + 10; x++) {
      const i = at(x, y);
      patch.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  const median = [0, 1, 2].map((c) => patch.map((p) => p[c]).sort((a, b) => a - b)[patch.length >> 1]);
  const ref = hsv(...median);
  const { hueTolerance, minSaturation, minValue } = photo.match;

  const candidate = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = at(x, y);
      const c = hsv(data[i], data[i + 1], data[i + 2]);
      candidate[y * w + x] = hueDistance(c.h, ref.h) <= hueTolerance && c.s >= minSaturation && c.v >= minValue ? 1 : 0;
    }
  }

  // Keep the region connected to the seed.
  const mask = flood(candidate, w, h, [photo.seed], (v) => v === 1);
  // Fill holes: anything not reachable from the border through non-garment pixels.
  const border = [];
  for (let x = 0; x < w; x++) border.push([x, 0], [x, h - 1]);
  for (let y = 0; y < h; y++) border.push([0, y], [w - 1, y]);
  const outside = flood(mask, w, h, border, (v) => v === 0);
  for (let i = 0; i < mask.length; i++) if (!outside[i]) mask[i] = 1;

  // Trim to the garment with a small margin.
  let [x0, y0, x1, y1] = [w, h, 0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  const bleed = photo.bleed ?? 0;
  const m = 4 + bleed;
  if (x0 - m < 0 || y0 - m < 0 || x1 + m > w - 1 || y1 + m > h - 1) {
    throw new Error(`${photo.id}: crop leaves no room for a ${m}px margin around the garment; widen it`);
  }
  x0 -= m; y0 -= m; x1 += m; y1 += m;
  const ow = x1 - x0 + 1;
  const oh = y1 - y0 + 1;
  const out = Buffer.alloc(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const si = at(x + x0, y + y0);
      const di = (y * ow + x) * 4;
      out[di] = data[si]; out[di + 1] = data[si + 1]; out[di + 2] = data[si + 2];
      out[di + 3] = mask[(y + y0) * w + x + x0] ? 255 : 0;
    }
  }
  if (bleed > 0) bleedOut(out, ow, oh, bleed);
  const file = join(APP, photo.out);
  await sharp(out, { raw: { width: ow, height: oh, channels: 4 } }).png().toFile(file);
  const hex = `#${median.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  console.log(`${photo.id}: wrote ${photo.out} (${ow}×${oh}, garment from ${x0 + m},${y0 + m} in the crop), garment colour ${hex}`);
  return file;
}

/**
 * Grow opaque pixels outward one ring at a time, `rings` times. Each new pixel
 * takes the average colour of its opaque 8-neighbours.
 */
function bleedOut(rgba, w, h, rings) {
  // The garment's outermost pixels are usually in shadow, and smearing them
  // makes dark streaks; start from a little way inside the edge instead.
  const EDGE = 3;
  const garment = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) garment[i] = rgba[i * 4 + 3] ? 1 : 0;
  for (let k = 0; k < EDGE; k++) {
    const edge = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (rgba[i * 4 + 3] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !rgba[((y + dy) * w + x + dx) * 4 + 3])) edge.push(i);
      }
    }
    for (const i of edge) rgba[i * 4 + 3] = 0;
  }
  rings += EDGE;
  for (let ring = 0; ring < rings; ring++) {
    const fills = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (rgba[(y * w + x) * 4 + 3]) continue;
        let [r, g, b, n] = [0, 0, 0, 0];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = (ny * w + nx) * 4;
            if (!rgba[j + 3]) continue;
            r += rgba[j]; g += rgba[j + 1]; b += rgba[j + 2]; n++;
          }
        }
        if (n) fills.push([(y * w + x) * 4, r / n, g / n, b / n]);
      }
    }
    for (const [i, r, g, b] of fills) {
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
  }
  // Soften the smeared part (outside the original garment) so it reads as plain cloth.
  for (let pass = 0; pass < 3; pass++) {
    const copy = Uint8ClampedArray.from(rgba);
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        if (garment[y * w + x] || !rgba[(y * w + x) * 4 + 3]) continue;
        for (let c = 0; c < 3; c++) {
          let sum = 0, n = 0;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const j = ((y + dy) * w + x + dx) * 4;
              if (copy[j + 3]) { sum += copy[j + c]; n++; }
            }
          }
          rgba[(y * w + x) * 4 + c] = sum / n;
        }
      }
    }
  }
}

/** 4-connected flood fill from the start points over cells where test(value) holds. */
function flood(grid, w, h, starts, test) {
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (const [x, y] of starts) {
    const i = y * w + x;
    if (test(grid[i]) && !seen[i]) { seen[i] = 1; stack.push(i); }
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i - x) / w;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (!seen[j] && test(grid[j])) { seen[j] = 1; stack.push(j); }
    }
  }
  return seen;
}

/** Draw the garment's seed.json landmarks on a copy of the cut-out. */
async function overlay(photo, file) {
  const garment = seed.garments.find((g) => g.id === photo.id);
  const lm = garment?.image?.landmarks;
  if (!lm) {
    console.log(`${photo.id}: no landmarks in seed.json yet, skipping overlay`);
    return;
  }
  const { width, height } = await sharp(file).metadata();
  const pt = (name) => lm[name];
  const outline = [
    'collarRight', 'shoulderRight', 'sleeveOuterRight', 'sleeveInnerRight', 'armpitRight', 'hemRight',
    'hemLeft', 'armpitLeft', 'sleeveInnerLeft', 'sleeveOuterLeft', 'shoulderLeft', 'collarLeft', 'neckFront',
  ].map((n) => `${pt(n).x},${pt(n).y}`).join(' ');
  const marks = Object.entries(lm).map(([name, { x, y }]) => {
    const right = name.endsWith('Right');
    const centre = !right && !name.endsWith('Left');
    const tx = centre ? x : right ? x + 12 : x - 12;
    // Armpit and sleeve-inner points sit close together: label one below, one above.
    const dy = name.startsWith('armpit') ? 22 : name.startsWith('sleeveInner') ? -6 : centre ? 26 : 5;
    return `<circle cx="${x}" cy="${y}" r="6" fill="#f2c12e" stroke="#1b2433" stroke-width="2.5"/>
      <text x="${tx}" y="${y + dy}" text-anchor="${centre ? 'middle' : right ? 'start' : 'end'}" font-family="Helvetica, Arial" font-size="17" font-weight="700" fill="#1b2433" stroke="#ffffff" stroke-width="4" paint-order="stroke">${name}</text>`;
  }).join('\n');
  const pad = 190;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width + 2 * pad}" height="${height + 40}">
    <g transform="translate(${pad} 20)">
      <polygon points="${outline}" fill="none" stroke="#1b2433" stroke-width="2" stroke-dasharray="8 6"/>
      ${marks}
    </g></svg>`;
  const target = file.replace(/\.png$/, '-overlay.png');
  await sharp({ create: { width: width + 2 * pad, height: height + 40, channels: 4, background: '#f1f3f6' } })
    .composite([{ input: file, left: pad, top: 20 }, { input: Buffer.from(svg), left: 0, top: 0 }])
    .png()
    .toFile(target);
  console.log(`${photo.id}: wrote ${target.slice(APP.length + 1)}`);
}

for (const photo of config.photos) {
  if (!existsSync(join(APP, photo.source))) {
    console.log(`${photo.id}: ${photo.source} not found, skipping (the app falls back to flat colour)`);
    continue;
  }
  const file = await cutOut(photo);
  if (withOverlay) await overlay(photo, file);
}
