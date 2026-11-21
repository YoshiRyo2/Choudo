import './NumberInput.css';

/** A number box with its unit printed inside, like a gauge. */
export interface NumberInputProps {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  hint?: string;
  invalid?: boolean;
  /** The id of this field's error message (a FieldError), read out while invalid. */
  errorId?: string;
  /** Show the label above the box (the fieldset legend covers it otherwise). */
  showLabel?: boolean;
  autoFocus?: boolean;
}

export function NumberInput({
  id,
  label,
  unit,
  value,
  onChange,
  onBlur,
  placeholder,
  hint,
  invalid,
  errorId,
  showLabel,
  autoFocus,
}: NumberInputProps) {
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
          onBlur={onBlur}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid && errorId ? errorId : undefined}
          autoFocus={autoFocus}
        />
        <span className="number-input__unit" aria-hidden="true">
          {unit}
        </span>
      </div>
    </div>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error" role="alert">
      {message}
    </p>
  );
}
