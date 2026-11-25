import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { precacheFiles, stampServiceWorker } from './serviceWorker.ts';

describe('precacheFiles', () => {
  it('lists the shell, manifest, icons, code and woff2 fonts; not photos, woff, the source icon or sw.js', () => {
    const files = [
      'index.html',
      'manifest.webmanifest',
      'favicon.ico',
      'icon-192.png',
      'choudo-app-icon-1024.png',
      'sw.js',
      'assets/index-abc.js',
      'assets/index-def.css',
      'assets/barlow-latin-400-normal-x.woff2',
      'assets/barlow-latin-400-normal-y.woff',
      'garments/ryo-grey-polo-front.png',
    ];
    expect(precacheFiles(files)).toEqual([
      './',
      'assets/barlow-latin-400-normal-x.woff2',
      'assets/index-abc.js',
      'assets/index-def.css',
      'favicon.ico',
      'icon-192.png',
      'manifest.webmanifest',
    ]);
  });
});

describe('stampServiceWorker', () => {
  const source = "// top\nconst BUILD = { cache: 'choudo-dev', precache: ['./'] };\nself.addEventListener('install', () => {});\n";

  it('writes the build cache name and precache list in place of the dev values', () => {
    const out = stampServiceWorker(source, 'choudo-1a2b3c', ['./', 'assets/index-abc.js']);
    expect(out).toBe(
      '// top\nconst BUILD = {"cache":"choudo-1a2b3c","precache":["./","assets/index-abc.js"]};\nself.addEventListener(\'install\', () => {});\n',
    );
  });

  it('throws when the BUILD line is missing, so a build never ships an unstamped worker', () => {
    expect(() => stampServiceWorker('self.x = 1;\n', 'choudo-1', ['./'])).toThrow(/BUILD/);
  });
});

describe('public/sw.js', () => {
  /** Runs the worker in a sandbox and returns its fetch handler. */
  function fetchHandler() {
    const listeners: Record<string, (event: unknown) => void> = {};
    const self = {
      location: new URL('https://yoshiryo2.github.io/Choudo/sw.js'),
      registration: { scope: 'https://yoshiryo2.github.io/Choudo/' },
      addEventListener: (type: string, fn: (event: unknown) => void) => (listeners[type] = fn),
    };
    const pending = () => new Promise(() => {}); // the test only looks at which requests it answers
    const caches = { match: pending, open: pending, keys: pending };
    runInNewContext(readFileSync(resolve(__dirname, '../public/sw.js'), 'utf8'), { self, caches, fetch: pending, URL, Promise });
    return (url: string, mode = 'no-cors') => {
      let answered = false;
      listeners.fetch!({ request: { method: 'GET', url, mode }, respondWith: () => (answered = true) });
      return answered;
    };
  }

  it('never answers (or caches) GoatCounter: its script and counts go straight to the network', () => {
    const handles = fetchHandler();
    expect(handles('https://gc.zgo.at/count.js')).toBe(false);
    expect(handles('https://choudo.goatcounter.com/count?p=fitting-room-opened&e=true&rnd=x')).toBe(false);
    // The site's own files still go through the worker.
    expect(handles('https://yoshiryo2.github.io/Choudo/assets/index-abc.js')).toBe(true);
    expect(handles('https://yoshiryo2.github.io/Choudo/?utm_campaign=friends', 'navigate')).toBe(true);
  });
});
