import type { FitTone } from '@choudo/core/domain/fit';

import { colors } from '@/theme';

/** A fit result's colour (styles.css .tone-*): fit colours are for fit results only. */
export const toneColor: Record<FitTone, string> = {
  good: colors.fitGood,
  warn: colors.fitWarn,
  bad: colors.fitBad,
  unknown: colors.muted,
};
