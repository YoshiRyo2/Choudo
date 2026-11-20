/**
 * Build only (`npm run build`): deletes every `local-only` garment photo from the
 * build output, so those files never reach the public site. Vite copies all of
 * public/ into dist/; this runs after it. The app never asks for them anyway
 * (`canWarp` is false), so those garments draw in their flat colour.
 */

import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { localOnlyFiles } from '../src/domain/garments/photo.ts';
import type { GarmentImage } from '../src/domain/garments/types.ts';

const SEED = 'src/domain/garments/seed.json';

export function leaveOutLocalPhotos(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'choudo-leave-out-local-photos',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    closeBundle() {
      const seed = JSON.parse(readFileSync(resolve(config.root, SEED), 'utf8')) as { garments: { image?: GarmentImage }[] };
      for (const file of localOnlyFiles(seed.garments)) {
        rmSync(resolve(config.root, config.build.outDir, file), { force: true });
      }
    },
  };
}
