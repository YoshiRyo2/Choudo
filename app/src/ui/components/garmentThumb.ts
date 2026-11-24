/**
 * Which picture a garment card shows: its front photo, or the flat drawing. Pure.
 */

import type { Garment, PhotoLicence } from '@choudo/core/domain/garments';

/**
 * Licences that let a photo be shown as it is. local-only photos are never shown:
 * they have no rights to publish and are left out of the production build.
 */
const SHOWN_UNALTERED: readonly PhotoLicence[] = ['own', 'brand-permission', 'affiliate-unaltered'];

/**
 * The URL of the garment's front photo for a card thumbnail, under the app's
 * `base` (import.meta.env.BASE_URL), or null to draw the flat icon instead.
 */
export function thumbPhotoSrc(garment: Pick<Garment, 'image'>, base: string): string | null {
  const image = garment.image;
  if (!image || !SHOWN_UNALTERED.includes(image.licence)) return null;
  return `${base}${image.file}`;
}
