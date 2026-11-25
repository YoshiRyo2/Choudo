import { useMemo } from 'react';
import { GARMENTS, publicGarments, type Garment } from '@choudo/core/domain/garments';

import { useTestMode } from './use-test-mode';

/**
 * The garments the app may show (the web App's `garments`): the sample rows only in
 * development or with Test mode on, never in a store build.
 */
export function useGarments(): readonly Garment[] {
  const [testMode] = useTestMode();
  // Test mode only counts in development, as on the web's devToolsOn (its switch is __DEV__ only).
  const testing = __DEV__ && testMode;
  const includeSamples = __DEV__ || testing;
  return useMemo(() => publicGarments(GARMENTS, { includeSamples }), [includeSamples]);
}
