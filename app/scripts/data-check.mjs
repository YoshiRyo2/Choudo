// Checks every garment in the seed and prints a report: errors, warnings,
// confidence grade, unscored zones, audit differences and images. Exits 1 on any error.
//
// Images: every file a garment's "image" points at must be in app/public/ and at least
// MIN_IMAGE_WIDTH_PX wide, unless .gitignore leaves it out on purpose (a photo we don't
// hold the rights to), so a fresh clone shows the same photos as this machine.
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
for (const g of SEED_GARMENTS) {
  if (!g.image || images.has(g.image.file)) continue;
  const path = resolve(appDir, 'public', g.image.file);
  const width = existsSync(path) ? ((await sharp(path).metadata()).width ?? null) : null;
  images.set(g.image.file, { width, localOnly: gitIgnored(resolve(appDir, 'public', g.image.file)) });
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
