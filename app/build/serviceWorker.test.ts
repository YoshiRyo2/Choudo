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
