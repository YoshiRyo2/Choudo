import './NumberInput.css';

/** A number box with its unit printed inside, like a gauge. */
export interface NumberInputProps {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  invalid?: boolean;
  /** Show the label above the box (the fieldset legend covers it otherwise). */
  showLabel?: boolean;
  autoFocus?: boolean;
}

export function NumberInput({ id, label, unit, value, onChange, placeholder, hint, invalid, showLabel, autoFocus }: NumberInputProps) {
  return (
    <div className="number-input">
      <label htmlFor={id} className={showLabel ? 'number-input__label' : 'visually-hidden'}>
        {label}
        {hint && <span className="number-input__hint">{hint}</span>}
      </label>
      <div className={`number-input__box${invalid ? ' is-invalid' : ''}`}>
        <input
          id={id}
          className="num"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          autoFocus={autoFocus}
        />
        <span className="number-input__unit" aria-hidden="true">
          {unit}
        </span>
      </div>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="field-error" role="alert">
      {message}
    </p>
  );
}
