import { useMemo } from 'react';
import { GARMENTS, publicGarments, type Garment } from '@choudo/core/domain/garments';

import { DEV_TOOLS } from '@/utils/dev-tools';

import { useTestMode } from './use-test-mode';

/**
 * The garments the app may show (the web App's `garments`): the sample rows only in
 * development, or with Test mode on (development and the preview fit-test build), never
 * in a store build.
 */
export function useGarments(): readonly Garment[] {
  const [testMode] = useTestMode();
  // Test mode only counts where its switch exists (DEV_TOOLS), as on the web's devToolsOn.
  const testing = DEV_TOOLS && testMode;
  const includeSamples = __DEV__ || testing;
  return useMemo(() => publicGarments(GARMENTS, { includeSamples }), [includeSamples]);
}
