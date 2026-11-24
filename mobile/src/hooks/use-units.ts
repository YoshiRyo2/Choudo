import { isUnitSystem, STORAGE_KEYS, type UnitSystem } from '@choudo/core/ui-logic/state/stored';

import { usePersistentState } from './use-persistent-state';

/** Display units: cm + kg, or ft/in + lb. Storage is always metric. */
export function useUnits(): [UnitSystem, (units: UnitSystem) => void] {
  return usePersistentState<UnitSystem>(STORAGE_KEYS.units, 'metric', isUnitSystem);
}
