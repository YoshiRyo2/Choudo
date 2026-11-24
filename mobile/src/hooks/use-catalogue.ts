import type { CatalogueScope } from '@choudo/core/domain/garments';
import { isCatalogueScope, STORAGE_KEYS } from '@choudo/core/ui-logic/state/stored';

import { usePersistentState } from './use-persistent-state';

/** Show garments for the body type's sizing (plus unisex), or all of them. */
export function useCatalogue(): [CatalogueScope, (scope: CatalogueScope) => void] {
  return usePersistentState<CatalogueScope>(STORAGE_KEYS.catalogue, 'matching', isCatalogueScope);
}
