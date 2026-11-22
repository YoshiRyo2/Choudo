// Checks every garment in the seed and prints a report: errors, warnings,
// confidence grade, unscored zones, audit differences and images. Exits 1 on any error.
//
// Images (front and back): every image needs a "licence". A "local-only" photo never ships and isn't
// checked; any other must be committed (not git-ignored), in app/public/ and at least
// MIN_IMAGE_WIDTH_PX wide, so a fresh clone and the public build show the same photos.
//
//   npm run data:check
//
// The checks themselves are pure TypeScript in src/domain/garments (see
// report.ts and verify.ts); this script only loads them and reads the disk.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { runnerImport } from 'vite';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const load = async (path) => (await runnerImport(resolve(appDir, path), { configFile: false, logLevel: 'silent' })).module;

const { SEED_GARMENTS } = await load('src/domain/garments/garments.ts');
const { buildReport, errorCount, formatReport } = await load('src/domain/garments/report.ts');

/** true when .gitignore leaves this path out. Without git (say, an unpacked zip), nothing is. */
function gitIgnored(path) {
  try {
    execFileSync('git', ['check-ignore', '-q', path], { cwd: appDir, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const images = new Map();
for (const image of SEED_GARMENTS.flatMap((g) => [g.image, g.backImage])) {
  if (!image || images.has(image.file)) continue;
  const path = resolve(appDir, 'public', image.file);
  const width = existsSync(path) ? ((await sharp(path).metadata()).width ?? null) : null;
  images.set(image.file, { width, gitIgnored: gitIgnored(path) });
}

const entries = buildReport(
  SEED_GARMENTS,
  (path) => existsSync(resolve(appDir, path)),
  (file) => images.get(file),
);
console.log(formatReport(entries));
if (errorCount(entries) > 0) {
  console.error('\nSome garments have errors and are left out of the app. Fix them before committing.');
  process.exit(1);
}
