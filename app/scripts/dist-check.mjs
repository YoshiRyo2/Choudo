// Checks the production build in dist/ before it's deployed (the Pages workflow runs it
// after npm run build): every URL in index.html and the manifest is under the base path
// and has a file behind it, the only other site it loads from is GoatCounter's script
// (there exactly once), the code names no site beyond the fetch service, Uniqlo's and Zara's
// image hosts, Zara's product pages and the ones it already named, the service worker is there, no dev-only page or
// local-only photo shipped, and the privacy and support pages are there. Exits 1 on any problem.
//
//   npm run build && npm run dist:check
//
// The checks are pure, in scripts/distCheck.mjs; this script only reads the disk.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';
import { distProblems, REQUIRED_PAGES } from './distCheck.mjs';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(appDir, 'dist');
const load = async (path) => (await runnerImport(resolve(appDir, path), { configFile: false, logLevel: 'silent' })).module;

if (!existsSync(resolve(dist, 'index.html'))) {
  console.error('No dist/index.html: run npm run build first.');
  process.exit(1);
}

const { PAGES_BASE } = await load('build/pagesBase.ts');
const { GOATCOUNTER_SCRIPT, GOATCOUNTER_TAG } = await load('build/goatCounter.ts');
const { SEED_GARMENTS } = await load('../packages/core/domain/garments/garments.ts');
const { localOnlyFiles } = await load('../packages/core/domain/garments/photo.ts');
const { FETCH_SERVICE, UNIQLO_IMAGE_HOST, ZARA_IMAGE_HOST } = await load('src/links/service.ts');

const files = readdirSync(dist, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => relative(dist, resolve(d.parentPath, d.name)).split(sep).join('/'));

const hostOf = (url) => new URL(url).hostname;
// Every site the code may name: the fetch service, Uniqlo's and Zara's photos, their product
// pages (links, and the addresses core builds: the page itself reads them through the fetch
// service), the seed's chart and product links (shown as links), SVG / XML namespaces, and
// React's error-message links.
const allowedHosts = [
  hostOf(FETCH_SERVICE),
  UNIQLO_IMAGE_HOST,
  ZARA_IMAGE_HOST,
  'www.uniqlo.com',
  'www.zara.com',
  ...[...JSON.stringify(SEED_GARMENTS).matchAll(/https?:\/\/[^"\s\\]+/g)].map(([url]) => hostOf(url)),
  'www.w3.org',
  'react.dev',
];
const scripts = Object.fromEntries(
  files.filter((f) => f.startsWith('assets/') && f.endsWith('.js')).map((f) => [f, readFileSync(resolve(dist, f), 'utf8')]),
);

const problems = distProblems({
  files,
  indexHtml: readFileSync(resolve(dist, 'index.html'), 'utf8'),
  manifest: JSON.parse(readFileSync(resolve(dist, 'manifest.webmanifest'), 'utf8')),
  localOnly: localOnlyFiles(SEED_GARMENTS),
  base: PAGES_BASE,
  swSource: existsSync(resolve(dist, 'sw.js')) ? readFileSync(resolve(dist, 'sw.js'), 'utf8') : '',
  analytics: { script: GOATCOUNTER_SCRIPT, tag: GOATCOUNTER_TAG },
  scripts,
  hosts: { allowed: allowedHosts, service: FETCH_SERVICE },
  pages: Object.fromEntries(
    REQUIRED_PAGES.filter((page) => existsSync(resolve(dist, page))).map((page) => [page, readFileSync(resolve(dist, page), 'utf8')]),
  ),
});

if (problems.length > 0) {
  console.error(`dist/ is not ready to deploy:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`dist/ is ready to deploy at ${PAGES_BASE}: ${files.length} files, no dev-only pages or local-only photos.`);
