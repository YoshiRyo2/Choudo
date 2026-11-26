import { createContext, useContext, useMemo } from 'react';
import { findGarment as findSeedGarment, GARMENTS, type Garment } from '@choudo/core/domain/garments';
import { readyFetched, type ReadyFetched } from '@choudo/core/ui-logic/state/fetched';
import { isFetchedList, isStringList, STORAGE_KEYS, type StoredFetched } from '@choudo/core/ui-logic/state/stored';

import { usePersistentState } from './use-persistent-state';

/** Garments read from pasted links, as stored (newest first): also the Check tab's 7-day cache. */
export function useFetchedList(): [StoredFetched[], (next: StoredFetched[]) => void] {
  return usePersistentState<StoredFetched[]>(STORAGE_KEYS.fetched, [], isFetchedList);
}

/** Hosts of pasted links Choudo can't read yet (listed in Test mode only). */
export function useUnsupportedHosts(): [string[], (next: string[]) => void] {
  return usePersistentState<string[]>(STORAGE_KEYS.unsupportedHosts, [], isStringList);
}

/** The stored fetched garments, checked and normalised like seed rows; any that fail are dropped. */
export function useFetchedGarments(): readonly ReadyFetched[] {
  const [list] = useFetchedList();
  return useMemo(() => readyFetched(list), [list]);
}

/** Finds a garment by id: the seed's, or one read from a link. */
export type FindGarment = (id: string) => Garment | undefined;

/** Every garment the app knows (fetched first, then the seed) and a lookup over them. */
export interface GarmentLookup {
  find: FindGarment;
  all: readonly Garment[];
}

/**
 * The garment lookup every screen uses, so an outfit or like can point at a fetched garment.
 * The root layout provides one over the seed and the fetched list (useGarmentLookup); without
 * a provider it's the seed alone. A fetched garment that was dropped isn't found, so whatever
 * points at it is skipped, never deleted.
 */
export const GarmentLookupContext = createContext<GarmentLookup>({ find: findSeedGarment, all: GARMENTS });

export const useFindGarment = (): FindGarment => useContext(GarmentLookupContext).find;
/** Every garment the app knows, for helpers that take a list (outfitLine). */
export const useKnownGarments = (): readonly Garment[] => useContext(GarmentLookupContext).all;

/** The lookup the root layout provides: fetched garments first, then the seed. */
export function useGarmentLookup(): GarmentLookup {
  const fetched = useFetchedGarments();
  return useMemo(() => {
    const byId = new Map(fetched.map((f) => [f.garment.id, f.garment]));
    const all = [...byId.values(), ...GARMENTS.filter((g) => !byId.has(g.id))];
    return { find: (id: string) => byId.get(id) ?? findSeedGarment(id), all };
  }, [fetched]);
}
