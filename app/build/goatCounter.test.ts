import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build, createServer, preview } from 'vite';
import {
  GOATCOUNTER_ENDPOINT,
  GOATCOUNTER_SCRIPT,
  GOATCOUNTER_TAG,
  goatCounterApplies,
  goatCounterPlugin,
  withGoatCounter,
  withoutGoatCounter,
} from './goatCounter.ts';

const PAGE = '<!doctype html>\n<html>\n  <head>\n    <title>Choudo</title>\n  </head>\n  <body></body>\n</html>\n';

describe('the GoatCounter snippet', () => {
  it('is the official one, with the site endpoint and an https script', () => {
    expect(GOATCOUNTER_ENDPOINT).toBe('https://choudo.goatcounter.com/count');
    expect(GOATCOUNTER_SCRIPT).toBe('https://gc.zgo.at/count.js');
    expect(GOATCOUNTER_TAG).toBe(
      '<script data-goatcounter="https://choudo.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>',
    );
  });

  it('goes in at the end of <head>, once', () => {
    const out = withGoatCounter(PAGE);
    expect(out).toContain(`${GOATCOUNTER_TAG}\n  </head>`);
    expect(withGoatCounter(out)).toBe(out);
  });

  it('throws on a page with no </head>', () => {
    expect(() => withGoatCounter('<html><body></body></html>')).toThrow(/head/);
  });

  it('comes out again for vite preview', () => {
    expect(withoutGoatCounter(withGoatCounter(PAGE))).not.toContain('goatcounter');
  });
});

describe('goatCounterApplies', () => {
  it('is on for the production build and the preview server only', () => {
    expect(goatCounterApplies({ command: 'build', mode: 'production' })).toBe(true);
    expect(goatCounterApplies({ command: 'serve', mode: 'production', isPreview: true })).toBe(true);
    expect(goatCounterApplies({ command: 'serve', mode: 'development' })).toBe(false);
    expect(goatCounterApplies({ command: 'serve', mode: 'test' })).toBe(false);
    expect(goatCounterApplies({ command: 'build', mode: 'development' })).toBe(false);
  });
});

describe('the page each Vite command serves', () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'choudo-goatcounter-'));
    writeFileSync(join(root, 'index.html'), PAGE);
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const config = (mode: string) => ({ root, mode, configFile: false as const, logLevel: 'silent' as const, plugins: [goatCounterPlugin()] });

  it('has the script in the production build', async () => {
    await build({ ...config('production'), build: { outDir: 'dist', emptyOutDir: true } });
    expect(readFileSync(join(root, 'dist/index.html'), 'utf8')).toContain(GOATCOUNTER_TAG);
  });

  it('has no script on the dev server or under Vitest (mode test)', async () => {
    for (const mode of ['development', 'test']) {
      const server = await createServer({ ...config(mode), server: { middlewareMode: true, ws: false } });
      try {
        expect(await server.transformIndexHtml('/', PAGE)).not.toContain('goatcounter');
      } finally {
        await server.close();
      }
    }
  });

  it('has no script on vite preview of the production build', async () => {
    await build({ ...config('production'), build: { outDir: 'dist', emptyOutDir: true } });
    const server = await preview({ ...config('production'), preview: { port: 0, host: '127.0.0.1' } });
    try {
      const url = server.resolvedUrls?.local[0];
      expect(url).toBeDefined();
      for (const path of ['', 'index.html', '?utm_campaign=friends']) {
        const html = await (await fetch(`${url}${path}`)).text();
        expect(html).toContain('<title>Choudo</title>');
        expect(html).not.toContain('goatcounter');
      }
    } finally {
      await server.close();
    }
  });
});
