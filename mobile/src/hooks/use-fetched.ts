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

/** Finds a garment by id: the seed's, or one read from a link. */
export type FindGarment = (id: string) => Garment | undefined;

/**
 * Every garment the app knows (fetched first, then the seed) and a lookup over them, plus the
 * stored fetched garments, checked and normalised like seed rows (any that fail are dropped).
 * Built once, in the root layout: every screen gets the same Garment objects for a fetched
 * garment, so `find(id)` and `fetched` agree (still, compare garments by id, never by object).
 */
export interface GarmentLookup {
  find: FindGarment;
  all: readonly Garment[];
  fetched: readonly ReadyFetched[];
}

/**
 * The garment lookup every screen uses, so an outfit or like can point at a fetched garment.
 * The root layout provides one over the seed and the fetched list (useGarmentLookup); without
 * a provider it's the seed alone. A fetched garment that was dropped isn't found, so whatever
 * points at it is skipped, never deleted.
 */
export const GarmentLookupContext = createContext<GarmentLookup>({ find: findSeedGarment, all: GARMENTS, fetched: [] });

export const useFindGarment = (): FindGarment => useContext(GarmentLookupContext).find;
/** Every garment the app knows, for helpers that take a list (outfitLine). */
export const useKnownGarments = (): readonly Garment[] => useContext(GarmentLookupContext).all;
/** The garments read from pasted links, newest first (the context's one ready list). */
export const useReadyFetched = (): readonly ReadyFetched[] => useContext(GarmentLookupContext).fetched;

/**
 * The lookup the root layout provides (the only place the stored list is readied): fetched
 * garments first, then the seed. Read it with useFindGarment, useKnownGarments, useReadyFetched.
 */
export function useGarmentLookup(): GarmentLookup {
  const [list] = useFetchedList();
  return useMemo(() => {
    const fetched = readyFetched(list);
    const byId = new Map(fetched.map((f) => [f.garment.id, f.garment]));
    const all = [...byId.values(), ...GARMENTS.filter((g) => !byId.has(g.id))];
    return { find: (id: string) => byId.get(id) ?? findSeedGarment(id), all, fetched };
  }, [list]);
}
