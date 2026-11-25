/**
 * Sampled fit odds, remembered per body + garment + preference so screens can
 * ask for them on every render (Discover cards, Closet tiles, size chips) without
 * re-sampling. The sampler is seeded, so a cached answer is the same answer.
 */

import type { BodyModel } from '../../domain/body';
import { sampleFit, type GarmentOdds, type PreferenceSpec, type UnderLayer } from '../../domain/fit';
import type { Garment } from '../../domain/garments';

const MAX_ENTRIES = 200;
const cache = new Map<string, GarmentOdds>();

function keyOf(body: BodyModel, garment: Garment, spec: PreferenceSpec, under?: UnderLayer): string {
  const layer = under ? [under.garment.id, under.sizeLabel] : null;
  return JSON.stringify([garment.id, body.measurements, body.sources, body.bra ?? null, spec, layer]);
}

/** Odds for a garment on the bare body, or over `under` (the Fitting room's jacket over its top). */
export function garmentOdds(body: BodyModel, garment: Garment, spec: PreferenceSpec, under?: UnderLayer): GarmentOdds {
  const key = keyOf(body, garment, spec, under);
  const hit = cache.get(key);
  if (hit) return hit;
  const odds = sampleFit(body, garment, spec, under ? { under } : {});
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, odds);
  return odds;
}

/** The odds `garmentOdds` would return, if they're already worked out; never samples. */
export function cachedOdds(body: BodyModel, garment: Garment, spec: PreferenceSpec, under?: UnderLayer): GarmentOdds | undefined {
  return cache.get(keyOf(body, garment, spec, under));
}
