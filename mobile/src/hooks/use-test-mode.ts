import { isBoolean, STORAGE_KEYS } from '@choudo/core/ui-logic/state/stored';

import { usePersistentState } from './use-persistent-state';

/** Whether the hidden Test mode (for the fit testers) is on. */
export function useTestMode(): [boolean, (on: boolean) => void] {
  return usePersistentState<boolean>(STORAGE_KEYS.testMode, false, isBoolean);
}
