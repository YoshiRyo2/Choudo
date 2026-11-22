#!/usr/bin/env node
/**
 * Build the app icons in public/ from the two hand-drawn masters in icons/:
 *
 *   icons/choudo.svg        full icon (home screen, install prompt)
 *   icons/choudo-small.svg  simplified for 32px and below (browser tab)
 *
 *   npm run icons
 *
 * The outputs are committed, so this only needs re-running after editing a master.
 * The maskable icon (Android crops it to a circle, squircle, etc.) is the full icon
 * with its #art group shrunk to 80% so it stays inside the 40%-radius safe circle.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(APP, 'public');

const full = await readFile(join(APP, 'icons/choudo.svg'), 'utf8');
const small = await readFile(join(APP, 'icons/choudo-small.svg'), 'utf8');

if (!full.includes('<g id="art">')) throw new Error('icons/choudo.svg needs a <g id="art"> group');
const maskable = full.replace('<g id="art">', '<g id="art" transform="translate(10 10) scale(0.8)">');

/** Masters use a 100-unit viewBox; render at the target size so edges stay crisp. */
async function png(svg, size, file) {
  await sharp(Buffer.from(svg), { density: (72 * size) / 100 })
    .resize(size, size)
    .png()
    .toFile(join(OUT, file));
  console.log(`  ${file} (${size}px)`);
}

await mkdir(OUT, { recursive: true });
console.log('Writing icons to public/:');
await writeFile(join(OUT, 'favicon.svg'), small);
console.log('  favicon.svg');
await png(small, 32, 'favicon-32.png');
await png(full, 180, 'apple-touch-icon.png');
await png(full, 192, 'icon-192.png');
await png(full, 512, 'icon-512.png');
await png(maskable, 512, 'icon-maskable-512.png');
