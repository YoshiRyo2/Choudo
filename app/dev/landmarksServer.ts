/**
 * Dev-server only (`npm run dev`): serves the landmark picker at /dev/landmarks
 * and lets it save into seed.json. `apply: 'serve'` keeps all of this out of
 * `npm run build`; the picker's page (dev/landmarks.html) isn't a build input.
 *
 *   GET  /__dev/garment-photos  -> each photo in scripts/garment-photos.json: its PNG, its side
 *                                 (front/back), whether it exists, and how far its colour padding
 *                                 reaches (inset, px)
 *   POST /__dev/landmarks       {id, file, landmarks, side} -> writes that garment's "image" (or,
 *                                 for the back, "backImage") in seed.json
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import type { GarmentImage, PhotoSide, SeedGarment } from '../src/domain/garments/types';
// App modules are loaded through Vite at request time (ssrLoadModule), not
// imported here, so the config itself stays plain Node-loadable.
type SeedWrite = typeof import('../src/dev/landmarks/seedWrite');
type Validate = typeof import('../src/domain/garments/validate');

const SEED = 'src/domain/garments/seed.json';
const PHOTOS = 'scripts/garment-photos.json';

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  let text = '';
  for await (const chunk of req) text += chunk;
  return JSON.parse(text);
}

export function landmarksDevServer(): Plugin {
  let root = '';
  return {
    name: 'choudo-landmarks-dev',
    apply: 'serve',
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (req.method === 'GET' && /^\/dev\/landmarks\/?(\?|$)/.test(url)) {
          req.url = url.replace(/^\/dev\/landmarks\/?/, '/dev/landmarks.html');
          return next();
        }
        if (req.method === 'GET' && url === '/__dev/garment-photos') {
          const config = JSON.parse(readFileSync(join(root, PHOTOS), 'utf8')) as {
            defaults?: { pad?: number; erode?: number };
            photos: { id: string; side?: PhotoSide; out?: string; method?: string; pad?: number; erode?: number; bleed?: number }[];
          };
          const photos = config.photos.map((p) => {
            const side: PhotoSide = p.side === 'back' ? 'back' : 'front';
            const out = p.out ?? `public/garments/${p.id}-${side}.png`;
            // How far the PNG's opaque area reaches past the garment: npm run photos pads it.
            const inset =
              p.method === 'colour'
                ? (p.bleed ?? 0)
                : (p.pad ?? config.defaults?.pad ?? 24) - (p.erode ?? config.defaults?.erode ?? 3);
            return { id: p.id, side, file: out.replace(/^public\//, ''), exists: existsSync(join(root, out)), inset };
          });
          return send(res, 200, photos);
        }
        if (req.method === 'POST' && url === '/__dev/landmarks') {
          readBody(req)
            .then(async (body) => {
              const { licenceForSave, writeGarmentImage } = (await server.ssrLoadModule('/src/dev/landmarks/seedWrite.ts')) as SeedWrite;
              const { validateImage } = (await server.ssrLoadModule('/src/domain/garments/validate.ts')) as Validate;
              const { id, file, landmarks, side: sent } = body as { id: string; file: string; landmarks: GarmentImage['landmarks']; side?: PhotoSide };
              const side: PhotoSide = sent === 'back' ? 'back' : 'front';
              const path = join(root, SEED);
              const text = readFileSync(path, 'utf8');
              const garment = (JSON.parse(text) as { garments: SeedGarment[] }).garments.find((g) => g.id === id);
              if (!garment) return send(res, 404, { error: `No garment "${id}" in seed.json` });
              const saved = side === 'back' ? garment.backImage : garment.image;
              const image: GarmentImage = {
                file,
                licence: licenceForSave(saved, file),
                photographedSize: saved?.photographedSize ?? null,
                landmarks,
              };
              const problems = validateImage(image, garment, side);
              if (problems.length) return send(res, 422, { error: problems.join('; ') });
              writeFileSync(path, writeGarmentImage(text, id, image, side));
              send(res, 200, { ok: true });
            })
            .catch((e: unknown) => send(res, 500, { error: String(e) }));
          return;
        }
        next();
      });
    },
  };
}
