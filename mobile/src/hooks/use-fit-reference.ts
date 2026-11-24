import type { Anchor, FitStyle } from '@choudo/core/domain/fit';
import { isAnchor, isFitStyle, STORAGE_KEYS } from '@choudo/core/ui-logic/state/stored';

import { usePersistentState } from './use-persistent-state';

export interface FitReference {
  /** A tee the user owns and likes the fit of. */
  anchor: Anchor | null;
  /** The answer to "How do you like tees to fit?". */
  style: FitStyle | null;
  /** Save both at once. Picking a style passes a null anchor, which clears it. */
  set: (anchor: Anchor | null, style: FitStyle | null) => void;
  clear: () => void;
}

/** The tee or fit style every other top is judged against. */
export function useFitReference(): FitReference {
  const [anchor, setAnchor] = usePersistentState<Anchor | null>(STORAGE_KEYS.anchor, null, isAnchor);
  const [style, setStyle] = usePersistentState<FitStyle | null>(STORAGE_KEYS.fitStyle, null, isFitStyle);
  const set = (nextAnchor: Anchor | null, nextStyle: FitStyle | null) => {
    setAnchor(nextAnchor);
    setStyle(nextStyle);
  };
  return { anchor, style, set, clear: () => set(null, null) };
}
