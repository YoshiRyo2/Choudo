// Checks every garment in the seed and prints a report: errors, warnings,
// confidence grade, unscored zones and audit differences. Exits 1 on any error.
//
//   npm run data:check
//
// The checks themselves are pure TypeScript in src/domain/garments (see
// report.ts and verify.ts); this script only loads them and reads the disk.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const load = async (path) => (await runnerImport(resolve(appDir, path), { configFile: false, logLevel: 'silent' })).module;

const { SEED_GARMENTS } = await load('src/domain/garments/garments.ts');
const { buildReport, errorCount, formatReport } = await load('src/domain/garments/report.ts');

const entries = buildReport(SEED_GARMENTS, (path) => existsSync(resolve(appDir, path)));
console.log(formatReport(entries));
if (errorCount(entries) > 0) {
  console.error('\nSome garments have errors and are left out of the app. Fix them before committing.');
  process.exit(1);
}
