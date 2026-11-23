/**
 * Layering: a jacket worn over a top. Pure.
 *
 * Size charts and ease bands are bare-body numbers, and a jacket is graded to go
 * over something light. So a jacket over a hoodie is compared with the body plus
 * only what the hoodie adds beyond that: its extra bulk, and a share of any spare
 * room it has (that much of it is still there once the jacket presses it down).
 * The drawing grows the layer underneath by the same bulk (skin rule). Whole
 * outfits, with layer notes, are fitted in outfit.ts.
 * See docs/clothing-categories-design.md §3.
 */

import type { BodyMeasurements } from '../body';
import { girthKnown, weightOf, type Garment, type GarmentType, type GarmentWeight } from '../garments';
import { girthRuleInCm } from './rules';
import { zoneRule } from './zones';

/**
 * Circumference a layer adds round the chest, by fabric weight (cm). ASSUMED from
 * fabric thickness: light (tee, shirt) 2π × ~0.8 mm, mid (sweatshirt, knit)
 * 2π × ~3 mm, heavy (heavy hoodie, fleece) 2π × ~5.5 mm.
 */
export const LAYER_BULK_CM: Record<GarmentWeight, number> = { light: 0.5, mid: 2, heavy: 3.5 };

/** What an outer layer's chart assumes is worn under it: only bulk beyond this counts. ASSUMED. */
export const OUTER_ASSUMES: GarmentWeight = 'light';

/**
 * Share of an under-layer's chest ease beyond "fitted" that still takes room
 * under a jacket (the rest is pressed flat or pushed round to the back). ASSUMED.
 */
export const UNDER_EASE_KEPT = 0.25;

/** A garment worn under another, in one of its sizes. */
export interface UnderLayer {
  garment: Garment;
  sizeLabel: string;
}

/** Who is under a garment fitted over a layer: for the readout ("with your hoodie under it"). */
export interface WornOver {
  garmentId: string;
  type: GarmentType;
}

const bulkBeyondAssumed = (g: Garment) => Math.max(0, LAYER_BULK_CM[weightOf(g)] - LAYER_BULK_CM[OUTER_ASSUMES]);

/**
 * How much the layer underneath adds to the body an outer layer is compared with
 * (cm of circumference). The waist gets the same as the chest: a top hangs
 * straight from the chest (ASSUMED). Spare ease counts only when the layer's
 * chest can be scored; otherwise just its bulk.
 */
export function layerAllowanceCm(body: BodyMeasurements, under: UnderLayer): { chestCm: number; waistCm: number } {
  const g = under.garment;
  const chest = g.sizes.find((s) => s.label === under.sizeLabel)?.measurements.chest;
  const rule = zoneRule(g, 'chest');
  let spare = 0;
  if (chest !== undefined && rule?.kind === 'girth' && girthKnown(g, 'chest')) {
    spare = Math.max(0, chest - body.chestCm - girthRuleInCm(rule, body.chestCm).fittedMax);
  }
  const chestCm = bulkBeyondAssumed(g) + UNDER_EASE_KEPT * spare;
  return { chestCm, waistCm: chestCm };
}

/** How far (cm, each side) the drawing grows the layer underneath before hanging the next one on it. */
export const layerGrowCm = (under: Garment): number => LAYER_BULK_CM[weightOf(under)] / (2 * Math.PI);
