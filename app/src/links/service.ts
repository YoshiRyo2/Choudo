/**
 * The other sites the website talks to for a pasted link, in one place (imports nothing, so
 * scripts/dist-check.mjs reads it too: these are the only new hosts a build may name).
 */

/** Choudo's fetch service (worker/, deployed by .github/workflows/deploy-worker.yml). */
export const FETCH_SERVICE = 'https://choudo-fetch.ryodyoshida.workers.dev';

/** Uniqlo's and Zara's photo hosts: the only other sites the page shows an <img> from. */
export const UNIQLO_IMAGE_HOST = 'image.uniqlo.com';
export const ZARA_IMAGE_HOST = 'static.zara.net';
