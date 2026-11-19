/**
 * Dev-server only (`npm run dev`): serves the landmark picker at /dev/landmarks
 * and lets it save into seed.json. `apply: 'serve'` keeps all of this out of
 * `npm run build`; the picker's page (dev/landmarks.html) isn't a build input.
 *
 *   GET  /__dev/garment-photos  -> which garments have a cut-out PNG, from scripts/garment-photos.json
 *   POST /__dev/landmarks       {id, file, landmarks} -> writes that garment's "image" in seed.json
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import type { GarmentImage, SeedGarment } from '../src/domain/garments/types';
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
    name: 'nimbus-landmarks-dev',
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
            photos: { id: string; out?: string }[];
          };
          const photos = config.photos.map((p) => {
            const out = p.out ?? `public/garments/${p.id}-front.png`;
            return { id: p.id, file: out.replace(/^public\//, ''), exists: existsSync(join(root, out)) };
          });
          return send(res, 200, photos);
        }
        if (req.method === 'POST' && url === '/__dev/landmarks') {
          readBody(req)
            .then(async (body) => {
              const { writeGarmentImage } = (await server.ssrLoadModule('/src/dev/landmarks/seedWrite.ts')) as SeedWrite;
              const { validateImage } = (await server.ssrLoadModule('/src/domain/garments/validate.ts')) as Validate;
              const { id, file, landmarks } = body as { id: string; file: string; landmarks: GarmentImage['landmarks'] };
              const path = join(root, SEED);
              const text = readFileSync(path, 'utf8');
              const garment = (JSON.parse(text) as { garments: SeedGarment[] }).garments.find((g) => g.id === id);
              if (!garment) return send(res, 404, { error: `No garment "${id}" in seed.json` });
              const image: GarmentImage = {
                file,
                photographedSize: garment.image?.photographedSize ?? null,
                landmarks,
              };
              const problems = validateImage(image, garment);
              if (problems.length) return send(res, 422, { error: problems.join('; ') });
              writeFileSync(path, writeGarmentImage(text, id, image));
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
