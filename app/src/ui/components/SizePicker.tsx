import { useId } from 'react';
import type { FitTone, GarmentFit } from '../../domain/fit';
import './SizePicker.css';

interface SizePickerProps {
  fits: GarmentFit[];
  selected: string | null;
  recommended: string | null;
  onSelect: (size: string) => void;
}

const TONE_NAME: Record<FitTone, string> = {
  good: 'fits',
  warn: 'fits with a caveat',
  bad: 'likely won’t fit',
  unknown: 'fit unknown',
};

/** One chip per size, each with a dot showing how that size would fit. */
export function SizePicker({ fits, selected, recommended, onSelect }: SizePickerProps) {
  const name = useId();
  return (
    <fieldset className="sizes">
      <legend className="sizes__legend">Size</legend>
      <div className="sizes__row">
        {fits.map((fit) => {
          const isSelected = fit.sizeLabel === selected;
          const isRecommended = fit.sizeLabel === recommended;
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
              <span className={`size-chip__dot tone-${fit.overall}`} aria-hidden="true" />
              <span className="visually-hidden">
                {TONE_NAME[fit.overall]}
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
