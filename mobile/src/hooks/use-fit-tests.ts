import { isFitTestList, STORAGE_KEYS, type FitTestRecord } from '@choudo/core/ui-logic/state/stored';

import { usePersistentState } from './use-persistent-state';

/** Test mode's results, kept on this phone until exported (the web's fitTests key). */
export function useFitTests(): [FitTestRecord[], (records: FitTestRecord[]) => void] {
  return usePersistentState<FitTestRecord[]>(STORAGE_KEYS.fitTests, [], isFitTestList);
}
