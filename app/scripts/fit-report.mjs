// Compares the app's predictions with how clothes actually fit testers.
// Reads the fit-test CSV (default: ../data/fit_tests.csv) and prints label
// agreement, within-one agreement, size hit rate and calibration.
//
//   npm run fit:report
//   npm run fit:report -- path/to/results.csv
//
// The maths is pure TypeScript in src/domain/fit/fitTestReport.ts; this script
// only reads the file.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const load = async (path) => (await runnerImport(resolve(appDir, path), { configFile: false, logLevel: 'silent' })).module;

const csvPath = resolve(process.cwd(), process.argv[2] ?? resolve(appDir, '../data/fit_tests.csv'));
if (!existsSync(csvPath)) {
  console.error(`No fit-test CSV at ${csvPath}.`);
  process.exit(1);
}

const { readFitTestCsv } = await load('src/domain/fit/fitTestCsv.ts');
const { buildFitTestReport, formatFitTestReport } = await load('src/domain/fit/fitTestReport.ts');

try {
  console.log(formatFitTestReport(buildFitTestReport(readFitTestCsv(readFileSync(csvPath, 'utf8')))));
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
