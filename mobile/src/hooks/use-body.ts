import type { BodyInput } from '@choudo/core/domain/body';
import { isStoredBody, STORAGE_KEYS } from '@choudo/core/ui-logic/state/stored';

import { usePersistentState } from './use-persistent-state';

/** The body saved on this phone, or null before the first-run Body screen. */
export function useBody(): [BodyInput | null, (body: BodyInput | null) => void] {
  return usePersistentState<BodyInput | null>(STORAGE_KEYS.body, null, isStoredBody);
}
