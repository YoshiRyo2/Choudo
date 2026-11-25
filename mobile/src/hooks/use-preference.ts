import { useMemo } from 'react';
import { preferenceSpec, type PreferenceSpec } from '@choudo/core/domain/fit';

import { useFitReference } from './use-fit-reference';

/** How the user likes tops to fit: the anchor tee, else the stated style, else Regular (as web App.tsx). */
export function usePreference(): PreferenceSpec {
  const { anchor, style } = useFitReference();
  return useMemo(() => preferenceSpec(anchor, style), [anchor, style]);
}
