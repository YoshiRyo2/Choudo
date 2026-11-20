// Checks the production build in dist/ before it's deployed (the Pages workflow runs it
// after npm run build): every URL in index.html and the manifest is under the base path
// and has a file behind it, the service worker is there, and no dev-only page or
// local-only photo shipped. Exits 1 on any problem.
//
//   npm run build && npm run dist:check
//
// The checks are pure, in scripts/distCheck.mjs; this script only reads the disk.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';
import { distProblems } from './distCheck.mjs';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(appDir, 'dist');
const load = async (path) => (await runnerImport(resolve(appDir, path), { configFile: false, logLevel: 'silent' })).module;

if (!existsSync(resolve(dist, 'index.html'))) {
  console.error('No dist/index.html: run npm run build first.');
  process.exit(1);
}

const { PAGES_BASE } = await load('build/pagesBase.ts');
const { SEED_GARMENTS } = await load('src/domain/garments/garments.ts');
const { localOnlyFiles } = await load('src/domain/garments/photo.ts');

const files = readdirSync(dist, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => relative(dist, resolve(d.parentPath, d.name)).split(sep).join('/'));

const problems = distProblems({
  files,
  indexHtml: readFileSync(resolve(dist, 'index.html'), 'utf8'),
  manifest: JSON.parse(readFileSync(resolve(dist, 'manifest.webmanifest'), 'utf8')),
  localOnly: localOnlyFiles(SEED_GARMENTS),
  base: PAGES_BASE,
});

if (problems.length > 0) {
  console.error(`dist/ is not ready to deploy:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`dist/ is ready to deploy at ${PAGES_BASE}: ${files.length} files, no dev-only pages or local-only photos.`);
