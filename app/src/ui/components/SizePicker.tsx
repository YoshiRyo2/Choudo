import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import type { FitTone, GarmentFit, GarmentOdds } from '../../domain/fit';
import { centredScrollLeft, chipTone } from './sizeRow';
import './SizePicker.css';

interface SizePickerProps {
  fits: GarmentFit[];
  selected: string | null;
  recommended: string | null;
  onSelect: (size: string) => void;
  /**
   * The garment's odds: each dot then takes the colour of that size's likeliest
   * verdict, as the verdict line does. Without them, the chart-only fit.
   */
  odds?: GarmentOdds;
  /**
   * 'wrap' (default): chips wrap onto more rows. 'row': one row that scrolls
   * sideways, keeping the selected chip in view (give it a `key` per garment so
   * it re-centres when the garment changes).
   */
  layout?: 'wrap' | 'row';
}

const TONE_NAME: Record<FitTone, string> = {
  good: 'fits',
  warn: 'fits with a caveat',
  bad: 'likely won’t fit',
  unknown: 'fit unknown',
};

/** One chip per size, each with a dot showing how that size would fit. */
export function SizePicker({ fits, selected, recommended, onSelect, odds, layout = 'wrap' }: SizePickerProps) {
  const name = useId();
  const rowRef = useRef<HTMLDivElement>(null);
  const isRow = layout === 'row';

  const centreSelected = (behavior: ScrollBehavior) => {
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>('.size-chip.is-selected');
    if (!row || !chip) return;
    const left = centredScrollLeft(row, { offsetLeft: chip.offsetLeft, width: chip.offsetWidth });
    // scrollTo on the row only, so the page itself never moves.
    row.scrollTo({ left, behavior });
  };

  // On mount (a new garment), jump straight to the selected chip.
  useLayoutEffect(() => {
    if (isRow) centreSelected('instant');
  }, [isRow]);

  // A size picked from elsewhere (or a chip at the edge) slides into the middle.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!isRow) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    centreSelected(reduce ? 'instant' : 'smooth');
  }, [selected, isRow]);

  return (
    <fieldset className={`sizes${isRow ? ' sizes--row' : ''}`}>
      <legend className={isRow ? 'visually-hidden' : 'sizes__legend'}>Size</legend>
      <div ref={rowRef} className="sizes__row">
        {fits.map((fit) => {
          const isSelected = fit.sizeLabel === selected;
          const isRecommended = fit.sizeLabel === recommended;
          const tone = chipTone(fit, odds);
          return (
            <label key={fit.sizeLabel} className={`size-chip${isSelected ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name={name}
                value={fit.sizeLabel}
                checked={isSelected}
                onChange={() => onSelect(fit.sizeLabel)}
              />
              <span className="size-chip__label num">{fit.sizeLabel}</span>
              <span className={`size-chip__dot tone-${tone}`} aria-hidden="true" />
              <span className="visually-hidden">
                {TONE_NAME[tone]}
                {isRecommended ? ', suggested size' : ''}
              </span>
              {isRecommended && (
                <span className="size-chip__suggested" aria-hidden="true">
                  Suggested
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
