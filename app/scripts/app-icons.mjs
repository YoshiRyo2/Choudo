#!/usr/bin/env node
/**
 * App icons from the two hand-drawn masters in icons/, written to public/ (the website)
 * and ../mobile/assets/images/ (the iPhone app):
 *
 *   icons/choudo.svg        the logo: 1024 px copy, Apple touch icon, manifest icons; the
 *                           phone's App Store icon (flattened, no alpha: Apple rejects one
 *                           with transparency), and the dress-form mark alone (the logo
 *                           without its background and circle) for the splash and Android
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
const MOBILE = fileURLToPath(new URL('../../mobile/assets/images/', import.meta.url));
const LOGO = await readFile(`${ICONS}choudo.svg`);
const SMALL = await readFile(`${ICONS}choudo-small.svg`);
/** The brand peach behind the logo (styles.css --brand). */
const BRAND = '#ffb59e';

/** The dress form alone: the logo without its full-bleed square and peach-soft circle. */
const MARK = Buffer.from(
  LOGO.toString('utf8')
    .replace(/<rect width="100" height="100"[^>]*\/>/, '')
    .replace(/<circle cx="50" cy="50" r="40"[^>]*\/>/, ''),
);
if (MARK.equals(LOGO)) throw new Error('choudo.svg changed: the background rect and circle were not found');

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

/** `art` (a 100-unit master) drawn `side` px wide in the middle of a transparent square. */
async function centred(svg, side, canvas) {
  const art = await render(svg, side);
  const pad = Math.round((canvas - side) / 2);
  return sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: art, left: pad, top: pad }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** The phone's images (Expo's app.json names). */
async function mobileIcons() {
  const out = {
    // App Store icon: the logo on its own peach, RGB with no alpha channel.
    'icon.png': await sharp(await render(LOGO, 1024)).flatten({ background: BRAND }).removeAlpha().png({ compressionLevel: 9 }).toBuffer(),
    // Splash: the mark on transparent; app.json shows it 160 pt wide on the app's background
    // (480 px: sharp at 3×).
    'splash-icon.png': await render(MARK, 480),
    'favicon.png': await render(SMALL, 48),
    // Android adaptive icon: the mark's artwork (the central 80 % of the master) inside the
    // 66 % safe zone of a 512 px square, over a flat peach layer; the monochrome icon is the
    // same shape in white (Android tints it).
    'android-icon-foreground.png': await centred(MARK, Math.round((512 * 0.66) / 0.8), 512),
    'android-icon-background.png': await sharp({ create: { width: 512, height: 512, channels: 3, background: BRAND } }).png().toBuffer(),
    'android-icon-monochrome.png': await sharp(await centred(MARK, Math.round((512 * 0.66) / 0.8), 512))
      .ensureAlpha()
      .extractChannel('alpha')
      .toColourspace('b-w')
      .toBuffer()
      .then((alpha) => sharp({ create: { width: 512, height: 512, channels: 3, background: '#ffffff' } }).joinChannel(alpha).png({ compressionLevel: 9 }).toBuffer()),
  };
  for (const [name, png] of Object.entries(out)) {
    await writeFile(`${MOBILE}${name}`, png);
    console.log(`mobile/assets/images/${name}`);
  }
}

async function main() {
  for (const [name, [svg, side]] of Object.entries(PNG_ICONS)) {
    await writeFile(`${PUBLIC}${name}`, await render(svg, side));
    console.log(`public/${name} (${side} px)`);
  }
  const pngs = await Promise.all(ICO_SIZES.map(async (side) => ({ side, png: await render(SMALL, side) })));
  await writeFile(`${PUBLIC}favicon.ico`, icoFromPngs(pngs));
  console.log(`public/favicon.ico (${ICO_SIZES.join(', ')} px)`);
  await mobileIcons();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
