/**
 * Keeping the saved outfit valid against the current catalogue and body.
 */

import type { BodyModel } from '../../domain/body';
import { recommendSize } from '../../domain/fit';
import { findGarment, garmentsByCategory, type Garment, type GarmentCategory } from '../../domain/garments';
import type { Outfit } from './stored';

/** The suggested size, or the middle size when nothing can be scored. */
export function defaultSize(body: BodyModel, garment: Garment): string {
  return recommendSize(body, garment) ?? garment.sizes[Math.floor(garment.sizes.length / 2)]!.label;
}

/**
 * Fill in anything missing or stale in a saved outfit: unknown garment ids fall
 * back to the first garment in that category, unknown sizes to the default size.
 */
export function resolveOutfit(outfit: Outfit, body: BodyModel): Outfit {
  const pick = (category: GarmentCategory, id: string | null, size: string | null) => {
    const found = id ? findGarment(id) : undefined;
    const garment = found?.category === category ? found : garmentsByCategory(category)[0];
    if (!garment) return { id: null, size: null };
    const sizeOk = size !== null && garment.sizes.some((s) => s.label === size);
    return { id: garment.id, size: sizeOk ? size : defaultSize(body, garment) };
  };
  const top = pick('top', outfit.topId, outfit.topSize);
  const bottom = pick('bottom', outfit.bottomId, outfit.bottomSize);
  return { topId: top.id, topSize: top.size, bottomId: bottom.id, bottomSize: bottom.size };
}
