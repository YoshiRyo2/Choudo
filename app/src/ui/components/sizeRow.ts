/**
 * The size picker's single scrolling row and its chips' dots. Pure.
 */

import type { FitTone, GarmentFit, GarmentOdds } from '@choudo/core/domain/fit';
import { sizeTone } from '../fitText';

/**
 * The row's scrollLeft that puts a chip in its middle, kept within the row's
 * scroll range. `offsetLeft` is the chip's left edge from the row's content start.
 */
export function centredScrollLeft(
  row: { clientWidth: number; scrollWidth: number },
  chip: { offsetLeft: number; width: number },
): number {
  const max = Math.max(0, row.scrollWidth - row.clientWidth);
  const centred = chip.offsetLeft + chip.width / 2 - row.clientWidth / 2;
  return Math.min(max, Math.max(0, centred));
}

/**
 * A size chip's dot: the tone of that size's likeliest verdict (`sizeTone`), so
 * it agrees with the verdict line; the chart-only `fit.overall` only where no
 * odds were worked out.
 */
export function chipTone(fit: Pick<GarmentFit, 'sizeLabel' | 'overall'>, odds?: GarmentOdds): FitTone {
  return odds ? sizeTone(odds, fit.sizeLabel) : fit.overall;
}
