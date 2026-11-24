import { isHeadKind, type HeadKind } from '@choudo/core/ui-logic/components/Mannequin/heads';
import { STORAGE_KEYS } from '@choudo/core/ui-logic/state/stored';

import { usePersistentState } from './use-persistent-state';

/** The mascot head on the mannequin (a drawing choice only), stored on this phone. */
export function useHead(): [HeadKind, (head: HeadKind) => void] {
  return usePersistentState<HeadKind>(STORAGE_KEYS.head, 'cloud', isHeadKind);
}
