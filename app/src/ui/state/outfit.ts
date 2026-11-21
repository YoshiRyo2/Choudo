/**
 * Keeping the saved outfit valid against the current catalogue and body.
 */

import type { BodyModel } from '../../domain/body';
import { fitGarment, type GarmentFit, type PreferenceSpec } from '../../domain/fit';
import { canWarp, findGarment, GARMENTS, type Garment, type GarmentCategory } from '../../domain/garments';
import { garmentOdds } from './odds';
import type { Outfit } from './stored';

/** The suggested size, or the middle size when nothing can be scored. */
export function defaultSize(body: BodyModel, garment: Garment, preference: PreferenceSpec): string {
  return garmentOdds(body, garment, preference).recommended ?? middleSize(garment);
}

/** The middle size in chart order (the upper middle for an even count). */
export function middleSize(garment: Garment): string {
  return garment.sizes[Math.floor(garment.sizes.length / 2)]!.label;
}

/**
 * The garment to start a category with: the first one on show with a photo the
 * mannequin may draw (own or brand-permission, see `canWarp`), else the first one.
 */
export function firstGarment(shown: readonly Garment[], category: GarmentCategory): Garment | undefined {
  const inCategory = shown.filter((g) => g.category === category);
  return inCategory.find((g) => canWarp(g.image)) ?? inCategory[0];
}

/**
 * Fill in anything missing or stale in a saved outfit: unknown garment ids fall
 * back to `firstGarment` in that category from `shown` (the garments on show,
 * the whole catalogue by default), unknown sizes to the default size. A garment
 * already worn stays on even when `shown` leaves it out. A category with nothing
 * to show is left empty. The jacket slot is never filled by default: only a
 * jacket that is worn stays (in a known size), anything else there is taken off.
 */
export function resolveOutfit(
  outfit: Outfit,
  body: BodyModel,
  preference: PreferenceSpec,
  shown: readonly Garment[] = GARMENTS,
): Outfit {
  const pick = (category: GarmentCategory, id: string | null, size: string | null) => {
    const found = id ? findGarment(id) : undefined;
    const garment = found?.category === category ? found : firstGarment(shown, category);
    if (!garment) return { id: null, size: null };
    const sizeOk = size !== null && garment.sizes.some((s) => s.label === size);
    return { id: garment.id, size: sizeOk ? size : defaultSize(body, garment, preference) };
  };
  const top = pick('top', outfit.topId, outfit.topSize);
  const bottom = pick('bottom', outfit.bottomId, outfit.bottomSize);
  const jacket = outfit.outerId ? findGarment(outfit.outerId) : undefined;
  const jacketSizeOk = jacket !== undefined && jacket.sizes.some((s) => s.label === outfit.outerSize);
  const outer =
    jacket?.category === 'outer'
      ? { id: jacket.id, size: jacketSizeOk ? outfit.outerSize : defaultSize(body, jacket, preference) }
      : { id: null, size: null };
  return { topId: top.id, topSize: top.size, bottomId: bottom.id, bottomSize: bottom.size, outerId: outer.id, outerSize: outer.size };
}

/** Put one garment on, in a size, keeping whatever is in the other slot. */
export function wearGarment(outfit: Outfit, garment: Garment, size: string): Outfit {
  if (garment.category === 'top') return { ...outfit, topId: garment.id, topSize: size };
  if (garment.category === 'outer') return { ...outfit, outerId: garment.id, outerSize: size };
  return { ...outfit, bottomId: garment.id, bottomSize: size };
}

/** The size we'd show a garment in, and how it fits. `recommended` is false for the middle-size fallback. */
export function suggestedFit(
  body: BodyModel,
  garment: Garment,
  preference: PreferenceSpec,
): { fit: GarmentFit; recommended: boolean } {
  const pick = garmentOdds(body, garment, preference).recommended;
  return { fit: fitGarment(body, garment, pick ?? middleSize(garment)), recommended: pick !== null };
}
