/**
 * Pure checks on a production build (no files read here), so they can be tested.
 * scripts/dist-check.mjs reads dist/ and prints what this returns.
 */

/**
 * Problems with a build in dist/, as messages; empty when it's fine to deploy.
 * @param {{ files: string[], indexHtml: string, manifest: { start_url?: string, icons?: { src: string }[] },
 *           localOnly: string[], base: string, swSource: string, analytics: { script: string, tag: string } }} build
 *   files: every file in dist/, relative to it with "/" separators. localOnly: the seed's
 *   local-only photo files. base: the site's path, e.g. "/Choudo/". swSource: dist/sw.js's text.
 *   analytics: GoatCounter's script URL and snippet (build/goatCounter.ts), the one thing
 *   index.html may load from another site, and which it must load exactly once.
 * @returns {string[]}
 */
export function distProblems({ files, indexHtml, manifest, localOnly, base, swSource, analytics }) {
  const problems = [];
  const have = new Set(files);
  const origin = 'https://pages.invalid';

  /** A site path's file in dist/: "/Choudo/" → index.html, "/Choudo/a.png" → a.png; null when outside the base. */
  const fileFor = (path) => {
    if (!path.startsWith(base)) return null;
    const rest = decodeURIComponent(path.slice(base.length));
    return rest === '' || rest.endsWith('/') ? `${rest}index.html` : rest;
  };
  const check = (where, path) => {
    const file = fileFor(path);
    if (file === null) problems.push(`${where} ${path} is outside ${base}`);
    else if (!have.has(file)) problems.push(`${where} ${path} is not in dist/`);
  };

  for (const [, url] of indexHtml.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    if (url.startsWith('//') || /^https?:/i.test(url)) {
      if (url !== analytics.script) problems.push(`index.html: ${url} is on another site (only ${analytics.script} may be)`);
      continue;
    }
    if (!url.startsWith('/')) continue; // relative
    check('index.html:', new URL(url, origin).pathname);
  }
  const tags = indexHtml.split(analytics.tag).length - 1;
  if (tags !== 1) problems.push(`index.html has the GoatCounter script ${tags} times, not once (build/goatCounter.ts)`);

  const manifestUrl = new URL(`${base}manifest.webmanifest`, origin);
  if (manifest.start_url !== undefined) check('manifest: start_url', new URL(manifest.start_url, manifestUrl).pathname);
  for (const icon of manifest.icons ?? []) check('manifest: icon', new URL(icon.src, manifestUrl).pathname);

  if (!have.has('sw.js')) problems.push('sw.js is missing');
  else {
    // build/serviceWorker.ts stamps a per-build cache and the files to precache.
    if (swSource.includes("'choudo-dev'")) problems.push('sw.js still has its dev cache name: the build did not stamp it');
    for (const [, url] of indexHtml.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
      const file = url.startsWith(base) ? url.slice(base.length) : null;
      if (file?.startsWith('assets/') && !swSource.includes(JSON.stringify(file))) {
        problems.push(`sw.js does not precache ${file}`);
      }
    }
  }
  for (const file of files) {
    if (file === 'landmarks.html' || file.startsWith('dev/')) problems.push(`${file} is dev-only and must not ship`);
  }
  for (const file of localOnly) {
    if (have.has(file)) problems.push(`${file} is local-only and must not ship`);
  }
  return problems;
}
