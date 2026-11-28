import { describe, expect, it } from 'vitest';
import { distProblems } from './distCheck.mjs';

const base = '/Choudo/';
const indexHtml = `<!doctype html><html><head>
<link rel="icon" href="/Choudo/favicon.ico" />
<link rel="manifest" href="/Choudo/manifest.webmanifest" />
<script type="module" crossorigin src="/Choudo/assets/index-abc.js"></script>
<script data-goatcounter="https://choudo.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
</head><body></body></html>`;
const manifest = { start_url: './', icons: [{ src: 'icon-192.png' }, { src: 'icon-512.png' }] };
const files = [
  'index.html',
  'favicon.ico',
  'manifest.webmanifest',
  'assets/index-abc.js',
  'icon-192.png',
  'icon-512.png',
  'sw.js',
  'garments/ryo-grey-polo-front.png',
  'privacy.html',
  'support.html',
];
const localOnly = ['garments/gildan-5000-front.png', 'garments/ryo-navy-graphic-tee-front.png'];
const swSource = 'const BUILD = {"cache":"choudo-1a2b3c","precache":["./","assets/index-abc.js"]};';
const analytics = {
  script: 'https://gc.zgo.at/count.js',
  tag: '<script data-goatcounter="https://choudo.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>',
};
const page = (title) => `<!doctype html><html><head><title>${title}</title></head><body><a href="./">Open Choudo</a></body></html>`;
const pages = { 'privacy.html': page('Privacy policy'), 'support.html': page('Support') };
const clean = { files, indexHtml, manifest, localOnly, base, swSource, analytics, pages };

describe('distProblems', () => {
  it('passes a clean build', () => {
    expect(distProblems(clean)).toEqual([]);
  });

  it('flags a root-relative URL outside the base path', () => {
    const html = indexHtml.replace('/Choudo/favicon.ico', '/favicon.ico');
    expect(distProblems({ ...clean, indexHtml: html })).toEqual(['index.html: /favicon.ico is outside /Choudo/']);
  });

  it('flags an index.html URL with no file behind it', () => {
    const html = indexHtml.replace('index-abc.js', 'index-old.js');
    expect(distProblems({ ...clean, indexHtml: html })).toEqual([
      'index.html: /Choudo/assets/index-old.js is not in dist/',
      'sw.js does not precache assets/index-old.js',
    ]);
  });

  it('allows only GoatCounter’s script from another site and nothing else', () => {
    const html = indexHtml.replace('</head>', '<link rel="stylesheet" href="https://fonts.example.com/x.css" />\n<script src="//cdn.example.com/a.js"></script>\n</head>');
    expect(distProblems({ ...clean, indexHtml: html })).toEqual([
      'index.html: https://fonts.example.com/x.css is on another site (only https://gc.zgo.at/count.js may be)',
      'index.html: //cdn.example.com/a.js is on another site (only https://gc.zgo.at/count.js may be)',
    ]);
  });

  it('flags a production build without the GoatCounter script, or with it twice', () => {
    const without = indexHtml.replace(analytics.tag, '');
    expect(distProblems({ ...clean, indexHtml: without })).toEqual([
      'index.html has the GoatCounter script 0 times, not once (build/goatCounter.ts)',
    ]);
    const twice = indexHtml.replace(analytics.tag, analytics.tag + analytics.tag);
    expect(distProblems({ ...clean, indexHtml: twice })).toEqual([
      'index.html has the GoatCounter script 2 times, not once (build/goatCounter.ts)',
    ]);
  });

  it('flags a manifest icon or start_url with no file behind it', () => {
    const broken = { start_url: './', icons: [{ src: '/icon-192.png' }, { src: 'icon-512.png' }] };
    expect(distProblems({ ...clean, manifest: broken })).toEqual(['manifest: icon /icon-192.png is outside /Choudo/']);
    expect(distProblems({ ...clean, manifest: { ...manifest, start_url: '/' } })).toEqual([
      'manifest: start_url / is outside /Choudo/',
    ]);
  });

  it('flags a missing service worker', () => {
    expect(distProblems({ ...clean, files: files.filter((f) => f !== 'sw.js') })).toEqual(['sw.js is missing']);
  });

  it('flags a service worker that was not stamped by the build', () => {
    expect(distProblems({ ...clean, swSource: "const BUILD = { cache: 'choudo-dev', precache: ['./'] };" })).toEqual([
      'sw.js still has its dev cache name: the build did not stamp it',
      'sw.js does not precache assets/index-abc.js',
    ]);
  });

  it('flags dev-only files', () => {
    expect(distProblems({ ...clean, files: [...files, 'landmarks.html', 'dev/landmarks.html'] })).toEqual([
      'landmarks.html is dev-only and must not ship',
      'dev/landmarks.html is dev-only and must not ship',
    ]);
  });

  it('flags a local-only photo', () => {
    expect(distProblems({ ...clean, files: [...files, 'garments/ryo-navy-graphic-tee-front.png'] })).toEqual([
      'garments/ryo-navy-graphic-tee-front.png is local-only and must not ship',
    ]);
  });

  it('flags a missing privacy policy or support page (the App Store links to both)', () => {
    const without = files.filter((f) => f !== 'privacy.html' && f !== 'support.html');
    expect(distProblems({ ...clean, files: without, pages: {} })).toEqual(['privacy.html is missing', 'support.html is missing']);
  });

  it('flags a page that does not link back to the app', () => {
    const lost = { ...pages, 'support.html': '<!doctype html><html><body>Support</body></html>' };
    expect(distProblems({ ...clean, pages: lost })).toEqual(['support.html does not link back to the app (href="./")']);
  });

  describe('the sites the code names', () => {
    const service = 'https://choudo-fetch.example.workers.dev';
    const hosts = { allowed: ['choudo-fetch.example.workers.dev', 'image.uniqlo.com', 'www.w3.org'], service };
    const code = `fetch("${service}/uniqlo/"+c+"/size-chart");const ns="http://www.w3.org/2000/svg";const img="image.uniqlo.com";`;

    it('passes code that names only allowed sites and reads links through the service', () => {
      expect(distProblems({ ...clean, scripts: { 'assets/index-abc.js': code }, hosts })).toEqual([]);
    });

    it('flags any other site, once per site', () => {
      const leaky = `${code}fetch("https://tracker.example.com/a");fetch("https://tracker.example.com/b");`;
      expect(distProblems({ ...clean, scripts: { 'assets/index-abc.js': leaky }, hosts })).toEqual([
        'assets/index-abc.js names tracker.example.com, which is not an allowed site (scripts/dist-check.mjs)',
      ]);
    });

    it('flags a build that reads links from anywhere but the fetch service', () => {
      const local = code.replace(service, 'http://localhost:8787');
      expect(distProblems({ ...clean, scripts: { 'assets/index-abc.js': local }, hosts })).toEqual([
        `no script reads links through the fetch service at ${service} (VITE_FETCH_BASE set for a production build?)`,
      ]);
    });
  });
});
