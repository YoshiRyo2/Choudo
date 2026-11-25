import { useEffect, useMemo, useState } from 'react';
import type { BodyModel } from '@choudo/core/domain/body';
import type { GarmentOdds, PreferenceSpec } from '@choudo/core/domain/fit';
import type { Garment } from '@choudo/core/domain/garments';
import { cachedOdds, garmentOdds } from '@choudo/core/ui-logic/state/odds';

interface Found {
  model: BodyModel;
  preference: PreferenceSpec;
  odds: Map<string, GarmentOdds>;
}

/**
 * Odds for a list of garments, worked out one per tick (setTimeout 0) in list order after the
 * first render, so a screen of tiles appears at once and fills in (a first sampling is
 * 60–180 ms on the phone). Odds already in the cache show straight away. Starts over when
 * the list, the body or the preference changes. While `active` is false (its tab isn't on
 * screen) it works nothing out, so it never slows another tab down.
 */
export function useOddsQueue(
  model: BodyModel,
  preference: PreferenceSpec,
  garments: readonly Garment[],
  active = true,
): Map<string, GarmentOdds> {
  const listKey = garments.map((g) => g.id).join('|');
  const [found, setFound] = useState<Found>(() => ({ model, preference, odds: new Map() }));

  useEffect(() => {
    setFound((f) => (f.model === model && f.preference === preference ? f : { model, preference, odds: new Map() }));
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const next = (from: number) => {
      let i = from;
      while (i < garments.length && cachedOdds(model, garments[i]!, preference)) i++;
      const garment = garments[i];
      if (!garment) return;
      timer = setTimeout(() => {
        const odds = garmentOdds(model, garment, preference);
        setFound((f) => (f.model === model && f.preference === preference ? { ...f, odds: new Map(f.odds).set(garment.id, odds) } : f));
        next(i + 1);
      }, 0);
    };
    next(0);
    return () => {
      if (timer) clearTimeout(timer);
    };
    // The list is compared by its ids, so a new array of the same garments doesn't restart it.
  }, [model, preference, listKey, active]);

  return useMemo(() => {
    const current = found.model === model && found.preference === preference ? found.odds : undefined;
    const out = new Map<string, GarmentOdds>();
    for (const g of garments) {
      const odds = current?.get(g.id) ?? cachedOdds(model, g, preference);
      if (odds) out.set(g.id, odds);
    }
    return out;
  }, [found, model, preference, garments]);
}
