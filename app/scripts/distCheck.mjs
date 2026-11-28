/**
 * Pure checks on a production build (no files read here), so they can be tested.
 * scripts/dist-check.mjs reads dist/ and prints what this returns.
 */

/** Static pages (app/public/) the App Store listing links to: the privacy policy and support. */
export const REQUIRED_PAGES = ['privacy.html', 'support.html'];

/**
 * Problems with a build in dist/, as messages; empty when it's fine to deploy.
 * @param {{ files: string[], indexHtml: string, manifest: { start_url?: string, icons?: { src: string }[] },
 *           localOnly: string[], base: string, swSource: string, analytics: { script: string, tag: string },
 *           pages: Record<string, string> }} build
 *   files: every file in dist/, relative to it with "/" separators. localOnly: the seed's
 *   local-only photo files. base: the site's path, e.g. "/Choudo/". swSource: dist/sw.js's text.
 *   analytics: GoatCounter's script URL and snippet (build/goatCounter.ts), the one thing
 *   index.html may load from another site, and which it must load exactly once.
 *   pages: the text of the static pages in REQUIRED_PAGES that are in dist/.
 *   scripts: the text of each built script (assets/*.js), by file.
 *   hosts: `allowed`, every other site a script may name (scripts/dist-check.mjs lists them:
 *   the fetch service, Uniqlo's image host, and what was there before: product and chart
 *   links, SVG namespaces, React's error links); `service`, the fetch service's address,
 *   which a script must name exactly (a build pointed at another VITE_FETCH_BASE fails).
 * @returns {string[]}
 */
export function distProblems({ files, indexHtml, manifest, localOnly, base, swSource, analytics, pages = {}, scripts = {}, hosts }) {
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
  // The code names only the sites it's allowed to, and reads links through the fetch service.
  if (hosts) {
    const allowed = new Set(hosts.allowed.map((h) => h.toLowerCase()));
    const named = new Map();
    for (const [file, text] of Object.entries(scripts)) {
      for (const [, host] of text.matchAll(/\bhttps?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)) {
        const h = host.toLowerCase();
        if (!allowed.has(h) && !named.has(h)) named.set(h, file);
      }
    }
    for (const [host, file] of named) problems.push(`${file} names ${host}, which is not an allowed site (scripts/dist-check.mjs)`);
    if (!Object.values(scripts).some((text) => text.includes(hosts.service))) {
      problems.push(`no script reads links through the fetch service at ${hosts.service} (VITE_FETCH_BASE set for a production build?)`);
    }
  }

  // The App Store listing links to these; each leads back to the app.
  for (const page of REQUIRED_PAGES) {
    if (!have.has(page)) problems.push(`${page} is missing`);
    else if (!(pages[page] ?? '').includes('href="./"')) problems.push(`${page} does not link back to the app (href="./")`);
  }
  return problems;
}
