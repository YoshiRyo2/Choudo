import { useEffect } from 'react';
import type { BodyModel } from '@choudo/core/domain/body';
import type { PreferenceSpec } from '@choudo/core/domain/fit';
import type { Garment } from '@choudo/core/domain/garments';

import { workOutOdds, type OddsQueueOptions } from './use-odds-queue';

/**
 * Works out the odds of garments the user is about to see (the Fitting room's neighbours,
 * Discover's next cards), a garment per tick after the render, into core's odds cache, so
 * swiping on to them is instant. Nothing is returned and nothing re-renders: the screen reads
 * the cache when it gets there. Drops what's queued when the list, body, preference or
 * `under` changes; does nothing while `active` is false.
 */
export function usePrefetchOdds(
  model: BodyModel,
  preference: PreferenceSpec,
  garments: readonly Garment[],
  { active = true, under }: OddsQueueOptions = {},
): void {
  const listKey = garments.map((g) => g.id).join('|');
  useEffect(() => {
    if (!active) return;
    return workOutOdds(model, preference, garments, under);
    // The list is compared by its ids, so a new array of the same garments doesn't restart it.
  }, [model, preference, under, listKey, active]);
}
