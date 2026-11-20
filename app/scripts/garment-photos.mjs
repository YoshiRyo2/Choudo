#!/usr/bin/env node
/**
 * Build step for garment photo textures: cut a garment out of a photo and save it
 * as a PNG under public/garments/.
 *
 *   npm run photos                     # cut out every photo whose source file is present
 *   npm run photos -- ryo-black-henley # just these garment ids
 *   npm run photos -- --overlay        # also draw each garment's landmarks from seed.json
 *                                      # onto a copy (…-overlay.png) for checking by eye
 *
 * Source photos live in photo-sources/ and aren't committed (we don't hold the
 * rights, or they're personal). The PNGs in public/garments/ are committed, except
 * ones from a photo we don't hold the rights to, which app/.gitignore lists.
 * Without the PNG the app simply draws the garment in its flat colour.
 *
 * Two ways to cut out, per photo in garment-photos.json:
 *
 *  - "ai" (the default): a background-removal model run locally (see
 *    photo-model.mjs for which and why). For a garment laid flat, any colour,
 *    on any reasonably plain floor. Steps: EXIF orientation, optional `rotate`,
 *    the model's mask, keep the biggest piece and fill holes, crop to it,
 *    downscale so the PNG's longest side is at most `maxSide`, erode the mask
 *    `erode` px (drops the fringe where garment meets floor), then pad `pad` px
 *    outside it with the nearest garment pixel's colour.
 *  - "colour": the older colour-matching cut-out, for a solid-colour garment
 *    worn by a model (a person would survive the AI cut-out). Keeps pixels whose
 *    hue and saturation match the garment near a seed point.
 *
 * Either way the edges end up in the garment's own colour. The app warps the
 * photo onto outlines that never match the photo's exactly, so this keeps
 * every size's outline the shirt's colour rather than floor or a shaded band.
 */

import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { boundingBox, cleanCutOut, largestRegion, medianColour, outputScale, threshold } from './photo-mask.mjs';
import { ensureModel, segment } from './photo-model.mjs';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(join(APP, 'scripts/garment-photos.json'), 'utf8'));
const seed = JSON.parse(await readFile(join(APP, 'src/domain/garments/seed.json'), 'utf8'));
const args = process.argv.slice(2);
const withOverlay = args.includes('--overlay');
const only = args.filter((a) => !a.startsWith('--'));
const DEFAULTS = { maxSide: 900, erode: 3, pad: 24, ...config.defaults };
const MODEL_FILE = join(APP, '.models/birefnet-lite.onnx');
/** Full-resolution photos are first shrunk to this longest side (px). */
const WORK_SIDE = 2400;
const outPath = (photo) => photo.out ?? `public/garments/${photo.id}-front.png`;

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

async function colourCutOut(photo) {
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
  const lm = seed.garments.find((g) => g.id === photo.id)?.image?.landmarks;
  settleEdges(out, ow, oh, {
    colour: median,
    bleed,
    fade: photo.fade ?? 0,
    // The neck opening, from the landmarks if we have them.
    keep: lm && { x0: lm.collarLeft.x - 6, x1: lm.collarRight.x + 6, y1: lm.neckFront.y + 4 },
  });
  const file = join(APP, outPath(photo));
  // A fresh clone may not have public/garments/ if no cut-out is committed yet.
  await mkdir(dirname(file), { recursive: true });
  await sharp(out, { raw: { width: ow, height: oh, channels: 4 } }).png().toFile(file);
  const hex = `#${median.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  console.log(`${photo.id}: wrote ${outPath(photo)} (${ow}×${oh}, garment from ${x0 + m},${y0 + m} in the crop), garment colour ${hex}`);
  return file;
}

/** The AI cut-out: see the header. */
async function aiCutOut(photo) {
  const opts = { ...DEFAULTS, ...photo };
  const started = Date.now();
  // Orientation first, then the photo's own rotation (two passes: sharp keeps one rotate per pipeline).
  const upright = await sharp(join(APP, photo.source)).autoOrient().toBuffer();
  const turned = opts.rotate ? await sharp(upright).rotate(opts.rotate).toBuffer() : upright;
  // A phone photo is ~12 MP; the model sees 1024 px and the PNG is at most maxSide,
  // so anything past a few thousand px only slows the clean-up down.
  const { data: rgb, info } = await sharp(turned)
    .resize({ width: WORK_SIDE, height: WORK_SIDE, fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  const alpha = await segment(await ensureModel(MODEL_FILE), rgb, w, h);
  const box = boundingBox(largestRegion(threshold(alpha), w, h), w, h);
  if (!box) throw new Error(`${photo.id}: no garment found in ${photo.source}`);

  // Crop to the garment, shrink, and leave a margin for the padding to grow into.
  const margin = opts.pad + 4;
  const scale = outputScale(box, opts.maxSide, margin);
  const gw = Math.max(1, Math.round(box.width * scale));
  const gh = Math.max(1, Math.round(box.height * scale));
  const shrink = (input, channels) => {
    const img = sharp(input, { raw: { width: w, height: h, channels } })
      .extract(box)
      .resize(gw, gh, { fit: 'fill' })
      .extend({ top: margin, bottom: margin, left: margin, right: margin, background: { r: 0, g: 0, b: 0 } });
    // sharp widens a one-channel image to RGB unless told otherwise.
    return (channels === 1 ? img.extractChannel(0) : img).raw().toBuffer();
  };
  const [smallRgb, smallAlpha] = await Promise.all([shrink(rgb, 3), shrink(alpha, 1)]);
  const ow = gw + 2 * margin;
  const oh = gh + 2 * margin;
  const { rgba, mask } = cleanCutOut(smallRgb, 3, smallAlpha, ow, oh, { erodePx: opts.erode, padPx: opts.pad });

  const file = join(APP, outPath(photo));
  await mkdir(dirname(file), { recursive: true });
  await sharp(rgba, { raw: { width: ow, height: oh, channels: 4 } }).png().toFile(file);
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(`${photo.id}: wrote ${outPath(photo)} (${ow}×${oh}) in ${secs}s, garment colour ${medianColour(rgba, mask)}`);
  return file;
}

/**
 * Settle the garment's edges into its own flat colour.
 *
 * Near its outline a photographed shirt is shaded (it curves away from the
 * camera) and the hem may be shadowed by hands. Stretched onto a big size those
 * edges read as a dark band, so within `fade` px of the outline the photo blends
 * into the garment's median colour, and the `bleed` px of padding outside the
 * garment is that flat colour. The neck opening is left alone so the collar
 * keeps its detail.
 */
function settleEdges(rgba, w, h, { colour, bleed, fade, keep }) {
  const inGarment = (i) => rgba[i * 4 + 3] > 0;
  const kept = (i) => {
    if (!keep) return false;
    const x = i % w;
    const y = (i - x) / w;
    return x >= keep.x0 && x <= keep.x1 && y <= keep.y1;
  };
  // Distance (4-connected steps) from the outline: inward for garment pixels, outward for the rest.
  const dist = new Int32Array(w * h).fill(-1);
  let ring = [];
  for (let i = 0; i < w * h; i++) {
    if (inGarment(i)) continue;
    const x = i % w;
    const y = (i - x) / w;
    const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < w && ny < h && inGarment(ny * w + nx);
    });
    if (touches && !kept(i)) { dist[i] = 0; ring.push(i); }
  }
  for (let d = 1; d <= Math.max(bleed, fade) && ring.length; d++) {
    const next = [];
    for (const i of ring) {
      const x = i % w;
      const y = (i - x) / w;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (dist[j] !== -1) continue;
        // Inward steps only through the garment, outward ones only outside it.
        if (inGarment(j) !== inGarment(i) && dist[i] !== 0) continue;
        dist[j] = d;
        next.push(j);
      }
    }
    ring = next;
  }
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let i = 0; i < w * h; i++) {
    const d = dist[i];
    const k = i * 4;
    if (inGarment(i)) {
      if (d < 1 || d > fade) continue;
      const t = smooth(d / fade);
      for (let c = 0; c < 3; c++) rgba[k + c] = Math.round(colour[c] + (rgba[k + c] - colour[c]) * t);
    } else if (d >= 0 && d <= bleed) {
      rgba[k] = colour[0]; rgba[k + 1] = colour[1]; rgba[k + 2] = colour[2]; rgba[k + 3] = 255;
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

const unknown = only.filter((id) => !config.photos.some((p) => p.id === id));
if (unknown.length) {
  console.error(`Not in scripts/garment-photos.json: ${unknown.join(', ')}`);
  process.exit(1);
}
for (const photo of config.photos) {
  if (only.length && !only.includes(photo.id)) continue;
  if (!existsSync(join(APP, photo.source))) {
    console.log(`${photo.id}: ${photo.source} not found, skipping (the app falls back to flat colour)`);
    continue;
  }
  const file = photo.method === 'colour' ? await colourCutOut(photo) : await aiCutOut(photo);
  if (withOverlay) await overlay(photo, file);
  const image = seed.garments.find((g) => g.id === photo.id)?.image;
  if (!image?.landmarks) {
    console.log(`  next: place its landmarks at http://localhost:5173/dev/landmarks?id=${photo.id} (npm run dev)`);
  }
}
