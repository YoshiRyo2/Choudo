import { useEffect, useMemo, useState } from 'react';
import type { BodyModel } from '@choudo/core/domain/body';
import type { GarmentOdds, PreferenceSpec, UnderLayer } from '@choudo/core/domain/fit';
import type { Garment } from '@choudo/core/domain/garments';
import { cachedOdds, garmentOdds } from '@choudo/core/ui-logic/state/odds';

interface Found {
  model: BodyModel;
  preference: PreferenceSpec;
  under: UnderLayer | undefined;
  odds: Map<string, GarmentOdds>;
}

export interface OddsQueueOptions {
  /** False while its screen isn't the one showing: nothing is worked out until it is again. */
  active?: boolean;
  /** Work the odds out over this top (a jacket tab's garments, as the Fitting room shows them). */
  under?: UnderLayer;
}

/**
 * Works out each garment's odds not yet cached, one per tick (setTimeout 0), in list order,
 * calling `found` with each. Returns a function that drops whatever is still queued.
 */
export function workOutOdds(
  model: BodyModel,
  preference: PreferenceSpec,
  garments: readonly Garment[],
  under: UnderLayer | undefined,
  found?: (garment: Garment, odds: GarmentOdds) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const next = (from: number) => {
    let i = from;
    while (i < garments.length && cachedOdds(model, garments[i]!, preference, under)) i++;
    const garment = garments[i];
    if (!garment) return;
    timer = setTimeout(() => {
      // Into core's cache whether or not anyone is told (`found?.(…)` would skip the sampling).
      const odds = garmentOdds(model, garment, preference, under);
      found?.(garment, odds);
      next(i + 1);
    }, 0);
  };
  next(0);
  return () => {
    if (timer) clearTimeout(timer);
  };
}

/**
 * Odds for a list of garments, worked out one per tick (setTimeout 0) in list order after the
 * first render, so a screen appears at once and fills in (a first sampling is 60–180 ms on the
 * phone): the Closet's tiles. Odds already in the cache show straight away. (To work odds out
 * ahead without showing them, use usePrefetchOdds: it never re-renders.)
 * Starts over (dropping what was queued) when the list, the body, the preference or `under`
 * changes. While `active` is false it works nothing out, so it never slows another tab down.
 */
export function useOddsQueue(
  model: BodyModel,
  preference: PreferenceSpec,
  garments: readonly Garment[],
  { active = true, under }: OddsQueueOptions = {},
): Map<string, GarmentOdds> {
  const listKey = garments.map((g) => g.id).join('|');
  const [found, setFound] = useState<Found>(() => ({ model, preference, under, odds: new Map() }));
  const same = (f: Found) => f.model === model && f.preference === preference && f.under === under;

  useEffect(() => {
    setFound((f) => (same(f) ? f : { model, preference, under, odds: new Map() }));
    if (!active) return;
    return workOutOdds(model, preference, garments, under, (garment, odds) =>
      setFound((f) => (same(f) ? { ...f, odds: new Map(f.odds).set(garment.id, odds) } : f)),
    );
    // The list is compared by its ids, so a new array of the same garments doesn't restart it.
  }, [model, preference, under, listKey, active]);

  return useMemo(() => {
    const current = same(found) ? found.odds : undefined;
    const out = new Map<string, GarmentOdds>();
    for (const g of garments) {
      const odds = current?.get(g.id) ?? cachedOdds(model, g, preference, under);
      if (odds) out.set(g.id, odds);
    }
    return out;
  }, [found, model, preference, under, garments]);
}
