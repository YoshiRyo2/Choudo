/**
 * Sampled fit odds, remembered per body + garment + preference so screens can
 * ask for them on every render (Discover cards, Closet tiles, size chips) without
 * re-sampling. The sampler is seeded, so a cached answer is the same answer.
 */

import type { BodyModel } from '../../domain/body';
import { sampleFit, type GarmentOdds, type PreferenceSpec } from '../../domain/fit';
import type { Garment } from '../../domain/garments';

const MAX_ENTRIES = 200;
const cache = new Map<string, GarmentOdds>();

function keyOf(body: BodyModel, garment: Garment, spec: PreferenceSpec): string {
  return JSON.stringify([garment.id, body.measurements, body.sources, body.bra ?? null, spec]);
}

export function garmentOdds(body: BodyModel, garment: Garment, spec: PreferenceSpec): GarmentOdds {
  const key = keyOf(body, garment, spec);
  const hit = cache.get(key);
  if (hit) return hit;
  const odds = sampleFit(body, garment, spec);
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, odds);
  return odds;
}
