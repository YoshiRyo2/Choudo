import { canWarp, type Garment, type GarmentImage } from '@choudo/core/domain/garments';

/**
 * Which side of the mannequin is drawn. A drawing option only: the body and the
 * fit are the same either way (skin rule), only front-only details and the photo
 * change.
 */
export type View = 'front' | 'back';

/**
 * The photo to warp onto this side of a garment, or undefined to draw it in flat
 * colour. The back only ever uses the back photo: a front photo (its graphic, its
 * placket) is never put on the back. Either one is warped only when its licence
 * allows it, unless `photos` is 'all' (the dev landmark picker).
 */
export function viewPhoto(
  garment: Pick<Garment, 'image' | 'backImage'>,
  view: View,
  photos: 'licensed' | 'all',
): GarmentImage | undefined {
  const image = view === 'back' ? garment.backImage : garment.image;
  return photos === 'all' || canWarp(image) ? image : undefined;
}
