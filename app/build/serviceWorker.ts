/**
 * Build only: stamps dist/sw.js with this build's cache name and the files to
 * precache, so the installed app opens offline from its very first launch and
 * each deploy gets a fresh cache (the worker deletes the old ones).
 *
 * public/sw.js has a dev line, `const BUILD = { cache: 'choudo-dev', precache: ['./'] };`,
 * that this replaces. Pure helpers first, then the Vite plugin.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

const BUILD_LINE = /^const BUILD = .*;$/m;

/**
 * What the worker precaches, relative to the site's base: the page (as "./"), the
 * manifest, icons, code and woff2 fonts. Not garment photos (fetched network-first and
 * cached as they're viewed), .woff fonts (every browser that installs PWAs uses woff2),
 * the 1024 px source icon, or the worker itself.
 */
export function precacheFiles(files: readonly string[]): string[] {
  return files
    .filter(
      (f) =>
        !f.startsWith('garments/') && !f.endsWith('.woff') && f !== 'choudo-app-icon-1024.png' && f !== 'sw.js',
    )
    .map((f) => (f === 'index.html' ? './' : f))
    .sort((a, b) => (a === './' ? -1 : b === './' ? 1 : a < b ? -1 : a > b ? 1 : 0));
}

/** The worker's source with its BUILD line replaced. Throws if there isn't exactly one. */
export function stampServiceWorker(source: string, cache: string, precache: readonly string[]): string {
  const lines = source.match(new RegExp(BUILD_LINE.source, 'gm')) ?? [];
  if (lines.length !== 1) throw new Error(`sw.js needs exactly one "const BUILD = ...;" line, found ${lines.length}`);
  return source.replace(BUILD_LINE, `const BUILD = ${JSON.stringify({ cache, precache })};`);
}

export function stampServiceWorkerPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'choudo-stamp-service-worker',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    closeBundle() {
      const dist = resolve(config.root, config.build.outDir);
      const files = readdirSync(dist, { recursive: true, withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => relative(dist, resolve(d.parentPath, d.name)).split(sep).join('/'));
      const precache = precacheFiles(files);
      // The cache name changes whenever any precached file does.
      const hash = createHash('sha256');
      for (const f of precache) hash.update(f).update(readFileSync(resolve(dist, f === './' ? 'index.html' : f)));
      const sw = resolve(dist, 'sw.js');
      writeFileSync(sw, stampServiceWorker(readFileSync(sw, 'utf8'), `choudo-${hash.digest('hex').slice(0, 12)}`, precache));
    },
  };
}
