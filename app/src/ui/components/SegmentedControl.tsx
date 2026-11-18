import { useId } from 'react';
import './SegmentedControl.css';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  /** Hide the visible label (it's still read by screen readers). */
  hideLabel?: boolean;
}

/** A row of mutually exclusive choices, built on radio inputs for keyboard + screen readers. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel,
}: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset className="segmented">
      <legend className={hideLabel ? 'visually-hidden' : 'segmented__label'}>{label}</legend>
      <div className="segmented__track">
        {options.map((o) => (
          <label key={o.value} className={`segmented__option${o.value === value ? ' is-active' : ''}`}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
