import { describe, expect, it } from 'vitest';
import { distProblems } from './distCheck.mjs';

const base = '/Choudo/';
const indexHtml = `<!doctype html><html><head>
<link rel="icon" href="/Choudo/favicon.ico" />
<link rel="manifest" href="/Choudo/manifest.webmanifest" />
<script type="module" crossorigin src="/Choudo/assets/index-abc.js"></script>
<link rel="stylesheet" href="https://fonts.example.com/x.css" />
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
const page = (title) => `<!doctype html><html><head><title>${title}</title></head><body><a href="./">Open Choudo</a></body></html>`;
const pages = { 'privacy.html': page('Privacy policy'), 'support.html': page('Support') };
const clean = { files, indexHtml, manifest, localOnly, base, swSource, pages };

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
});
