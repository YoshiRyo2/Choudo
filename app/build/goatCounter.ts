/**
 * Anonymous visit counts with GoatCounter (https://www.goatcounter.com, site code "choudo"):
 * page views plus the fixed event names in src/ui/analytics.ts. No cookies; nothing the
 * user enters is ever sent.
 *
 * The production build (`vite build`, deployed to GitHub Pages) gets GoatCounter's official
 * snippet in index.html. The dev server, Vitest and `vite preview` never load it: the plugin
 * isn't applied to the first two, and the preview server strips the tag from the page it
 * serves. Pure helpers first, then the Vite plugin.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConfigEnv, Plugin } from 'vite';

/** Where count.js sends page views and events. */
export const GOATCOUNTER_ENDPOINT = 'https://choudo.goatcounter.com/count';
/** GoatCounter's script, always over https (the official snippet's `//` would follow the page). */
export const GOATCOUNTER_SCRIPT = 'https://gc.zgo.at/count.js';
/** The official snippet. */
export const GOATCOUNTER_TAG = `<script data-goatcounter="${GOATCOUNTER_ENDPOINT}" async src="${GOATCOUNTER_SCRIPT}"></script>`;

/** The page with the snippet added at the end of <head>. Throws when there's no </head>. */
export function withGoatCounter(html: string): string {
  if (html.includes(GOATCOUNTER_TAG)) return html;
  if (!html.includes('</head>')) throw new Error('index.html has no </head> to put the GoatCounter script in');
  return html.replace('</head>', `  ${GOATCOUNTER_TAG}\n  </head>`);
}

/** The page without the snippet (for vite preview). */
export function withoutGoatCounter(html: string): string {
  return html.replaceAll(GOATCOUNTER_TAG, '');
}

/** Only the production build counts; the preview server is applied so it can strip the tag. */
export function goatCounterApplies(env: ConfigEnv): boolean {
  return (env.command === 'build' && env.mode === 'production') || env.isPreview === true;
}

export function goatCounterPlugin(): Plugin {
  return {
    name: 'choudo-goatcounter',
    apply: (_config, env) => goatCounterApplies(env),
    transformIndexHtml: { order: 'post', handler: (html) => withGoatCounter(html) },
    configurePreviewServer(server) {
      const { base, root, build } = server.config;
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        if (req.method !== 'GET' || (path !== base && path !== `${base}index.html`)) return next();
        try {
          const html = readFileSync(resolve(root, build.outDir, 'index.html'), 'utf8');
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(withoutGoatCounter(html));
        } catch {
          next(); // no build yet: let vite preview say so
        }
      });
    },
  };
}
