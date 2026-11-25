import { EMPTY_OUTFIT, isOutfit, STORAGE_KEYS, type Outfit } from '@choudo/core/ui-logic/state/stored';

import { usePersistentState } from './use-persistent-state';

/** The outfit on the Fitting room's mannequin, as stored (may be stale: resolveOutfit fixes it). */
export function useOutfit(): [Outfit, (outfit: Outfit) => void] {
  return usePersistentState<Outfit>(STORAGE_KEYS.outfit, EMPTY_OUTFIT, isOutfit);
}
