#!/usr/bin/env node
/**
 * App icons from the two hand-drawn masters in icons/, written to public/:
 *
 *   icons/choudo.svg        the logo: 1024 px copy, Apple touch icon, manifest icons
 *   icons/choudo-small.svg  simplified for 48 px and below: favicon PNG and favicon.ico
 *
 *   npm run icons
 *
 * The logo is a full-bleed square with its artwork inside the central 80% circle,
 * so the same picture works as a "maskable" icon (Android crops it to a circle or
 * squircle) without extra padding. Outputs are committed; rerun after changing a master.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { icoFromPngs } from './app-icons-ico.mjs';

const ICONS = fileURLToPath(new URL('../icons/', import.meta.url));
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const LOGO = await readFile(`${ICONS}choudo.svg`);
const SMALL = await readFile(`${ICONS}choudo-small.svg`);

/** PNGs to write: file name -> [master, side in px]. */
const PNG_ICONS = {
  'choudo-app-icon-1024.png': [LOGO, 1024],
  'apple-touch-icon.png': [LOGO, 180],
  'icon-192.png': [LOGO, 192],
  'icon-512.png': [LOGO, 512],
  'favicon-32.png': [SMALL, 32],
};

/** Sizes packed into favicon.ico, for browsers and tools that only ask for /favicon.ico. */
const ICO_SIZES = [16, 32, 48];

/** The masters use a 100-unit viewBox; rasterise at the target size so edges stay crisp. */
const render = (svg, side) =>
  sharp(svg, { density: (72 * side) / 100 }).resize(side, side).png({ compressionLevel: 9 }).toBuffer();

async function main() {
  for (const [name, [svg, side]] of Object.entries(PNG_ICONS)) {
    await writeFile(`${PUBLIC}${name}`, await render(svg, side));
    console.log(`public/${name} (${side} px)`);
  }
  const pngs = await Promise.all(ICO_SIZES.map(async (side) => ({ side, png: await render(SMALL, side) })));
  await writeFile(`${PUBLIC}favicon.ico`, icoFromPngs(pngs));
  console.log(`public/favicon.ico (${ICO_SIZES.join(', ')} px)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
