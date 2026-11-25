#!/usr/bin/env node
/**
 * M PLUS Rounded 1c, cut down to the characters the app can draw (it's a Japanese font:
 * the full files are about 3.4 MB each, the Latin subsets a few tens of KB).
 *
 *   npm run fonts      (from mobile/)
 *
 * Reads the three weights the app uses from @expo-google-fonts/m-plus-rounded-1c and writes
 * assets/fonts/MPLUSRounded1c-{Medium,Bold,ExtraBold}.ttf plus the font's licence (OFL.txt).
 * Ranges: Google Fonts' "latin" subset, the arrows block, and the maths signs in the copy.
 * The font has no Reserved Font Name, so the subset keeps its name. Outputs are committed;
 * src/tests/font-coverage.test.ts fails if the copy ever uses a character outside them.
 */

import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const require = createRequire(import.meta.url);
const SOURCE = dirname(require.resolve('@expo-google-fonts/m-plus-rounded-1c/package.json'));
const OUT = fileURLToPath(new URL('../assets/fonts/', import.meta.url));

const WEIGHTS = [
  ['500Medium/MPLUSRounded1c_500Medium.ttf', 'MPLUSRounded1c-Medium.ttf'],
  ['700Bold/MPLUSRounded1c_700Bold.ttf', 'MPLUSRounded1c-Bold.ttf'],
  ['800ExtraBold/MPLUSRounded1c_800ExtraBold.ttf', 'MPLUSRounded1c-ExtraBold.ttf'],
];

/** Inclusive code point ranges. */
const RANGES = [
  // Google Fonts "latin": U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC,
  // U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD
  [0x0000, 0x00ff], [0x0131, 0x0131], [0x0152, 0x0153], [0x02bb, 0x02bc], [0x02c6, 0x02c6], [0x02da, 0x02da],
  [0x02dc, 0x02dc], [0x0304, 0x0304], [0x0308, 0x0308], [0x0329, 0x0329], [0x2000, 0x206f], [0x20ac, 0x20ac],
  [0x2122, 0x2122], [0x2215, 0x2215], [0xfeff, 0xfeff], [0xfffd, 0xfffd],
  // Arrows (→ in the copy, ↑ ↓ in the latin set).
  [0x2190, 0x21ff],
  // Maths signs the copy uses: − × ≤ ≥ ±.
  [0x2212, 0x2212], [0x00d7, 0x00d7], [0x2264, 0x2265], [0x00b1, 0x00b1],
];

const characters = RANGES.flatMap(([from, to]) => Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i))).join('');

for (const [from, to] of WEIGHTS) {
  const subset = await subsetFont(await readFile(join(SOURCE, from)), characters, { targetFormat: 'truetype' });
  await writeFile(join(OUT, to), subset);
  console.log(`assets/fonts/${to} (${Math.round(subset.length / 1024)} KB)`);
}
await copyFile(join(SOURCE, 'LICENSE_FONT'), join(OUT, 'OFL.txt'));
console.log('assets/fonts/OFL.txt');
