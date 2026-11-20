#!/usr/bin/env node
/**
 * App icons from the one 1024 px logo: favicon, Apple touch icon and the web-app
 * manifest's icons, all written next to the source in public/.
 *
 *   npm run icons
 *
 * The logo is a full-bleed square with its artwork inside the central 80% circle,
 * so the same picture works as a "maskable" icon (Android crops it to a circle or
 * squircle) without extra padding. Outputs are committed; rerun after changing the logo.
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { icoFromPngs } from './app-icons-ico.mjs';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const SOURCE = `${PUBLIC}choudo-app-icon-1024.png`;

/** PNGs to write: file name -> side in px. */
const PNG_ICONS = {
  'favicon-32.png': 32,
  'apple-touch-icon.png': 180,
  'icon-192.png': 192,
  'icon-512.png': 512,
};

/** Sizes packed into favicon.ico, for browsers and tools that only ask for /favicon.ico. */
const ICO_SIZES = [16, 32, 48];

const resize = (side) => sharp(SOURCE).resize(side, side, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer();

async function main() {
  for (const [name, side] of Object.entries(PNG_ICONS)) {
    await writeFile(`${PUBLIC}${name}`, await resize(side));
    console.log(`public/${name} (${side} px)`);
  }
  const pngs = await Promise.all(ICO_SIZES.map(async (side) => ({ side, png: await resize(side) })));
  await writeFile(`${PUBLIC}favicon.ico`, icoFromPngs(pngs));
  console.log(`public/favicon.ico (${ICO_SIZES.join(', ')} px)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
