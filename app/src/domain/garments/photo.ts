/**
 * What a garment photo's licence lets the app do with it. Pure.
 */

import type { GarmentImage } from './types';

/** Only photos we took, or a brand allowed, may be warped onto the mannequin. */
export function canWarp(image: GarmentImage | undefined): boolean {
  return image?.licence === 'own' || image?.licence === 'brand-permission';
}

/** Photo files that must stay out of the production build, each listed once. */
export function localOnlyFiles(garments: readonly { image?: GarmentImage }[]): string[] {
  const files = garments.flatMap((g) => (g.image?.licence === 'local-only' ? [g.image.file] : []));
  return [...new Set(files)];
}
