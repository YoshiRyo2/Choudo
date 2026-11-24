/**
 * What a garment photo's licence lets the app do with it. Pure.
 */

import type { GarmentImage } from './types';

/** Only photos we took, or a brand allowed, may be warped onto the mannequin. */
export function canWarp(image: GarmentImage | undefined): boolean {
  return image?.licence === 'own' || image?.licence === 'brand-permission';
}

/** Photo files (front and back) that must stay out of the production build, each listed once. */
export function localOnlyFiles(garments: readonly { image?: GarmentImage; backImage?: GarmentImage }[]): string[] {
  const files = garments.flatMap((g) => [g.image, g.backImage].flatMap((i) => (i?.licence === 'local-only' ? [i.file] : [])));
  return [...new Set(files)];
}
